import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingType, PaymentStatus } from './enums/payment.enums';
import {
  PAYABLE_FLIGHT_BOOKINGS,
  PAYABLE_HOTEL_BOOKINGS,
} from './payable-booking.interface';
import type { PayableBookingService } from './payable-booking.interface';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import {
  PolicyAcceptance,
  PolicyAcceptanceDocument,
} from './schemas/policy-acceptance.schema';
import {
  ProcessedStripeEvent,
  ProcessedStripeEventDocument,
} from './schemas/processed-stripe-event.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(PolicyAcceptance.name)
    private readonly policyAcceptanceModel: Model<PolicyAcceptanceDocument>,
    @InjectModel(ProcessedStripeEvent.name)
    private readonly processedEventModel: Model<ProcessedStripeEventDocument>,
    @Inject(PAYABLE_FLIGHT_BOOKINGS)
    private readonly flightBookings: PayableBookingService,
    @Inject(PAYABLE_HOTEL_BOOKINGS)
    private readonly hotelBookings: PayableBookingService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('stripe.secretKey') ?? '');
  }

  private bookingServiceFor(type: BookingType): PayableBookingService {
    return type === BookingType.FLIGHT
      ? this.flightBookings
      : this.hotelBookings;
  }

  // PAY-02: record that the user has seen and accepted the booking's policies
  async acceptPolicies(
    userId: string,
    bookingType: BookingType,
    bookingId: string,
  ) {
    const bookingService = this.bookingServiceFor(bookingType);
    const booking = await bookingService.findPayable(bookingId);

    if (booking.ownerId !== userId) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.policiesAcceptedAt) {
      throw new ConflictException(
        'Policies already accepted for this booking',
      );
    }

    const acceptedAt = new Date();

    try {
      await this.policyAcceptanceModel.create({
        bookingType,
        bookingId,
        userId,
        acceptedAt,
        policySnapshot: booking.policySnapshot,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(
          'Policies already accepted for this booking',
        );
      }
      throw err;
    }

    await bookingService.markPoliciesAccepted(bookingId, acceptedAt);

    return { bookingType, bookingId, acceptedAt };
  }

  // PAY-01: create a PaymentIntent for a Pending Payment booking
  async createPayment(userId: string, dto: CreatePaymentDto) {
    const bookingService = this.bookingServiceFor(dto.bookingType);
    const booking = await bookingService.findPayable(dto.bookingId);

    if (booking.ownerId !== userId) {
      throw new NotFoundException('Booking not found');
    }
    this.assertPayable(booking.status, booking.holdExpiresAt);
    if (!booking.policiesAcceptedAt) {
      throw new ConflictException(
        'Policies must be accepted before paying (PAY-02)',
      );
    }

    const currency = this.config.get<string>('defaultCurrency') ?? 'USD';

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(booking.amount * 100),
        currency: currency.toLowerCase(),
        metadata: { bookingType: dto.bookingType, bookingId: dto.bookingId },
      },
      { idempotencyKey: `payment-${dto.bookingType}-${dto.bookingId}` },
    );

    const payment = await this.paymentModel.create({
      bookingType: dto.bookingType,
      bookingId: dto.bookingId,
      userId,
      providerId: booking.providerId,
      stripePaymentIntentId: intent.id,
      amount: booking.amount,
      currency,
      status: PaymentStatus.PENDING,
    });

    return { paymentId: payment.id, clientSecret: intent.client_secret };
  }

  // PAY-01: retry with a new PaymentIntent before the hold expires
  async retryPayment(userId: string, paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment || payment.userId.toString() !== userId) {
      throw new NotFoundException('Payment not found');
    }

    const bookingService = this.bookingServiceFor(payment.bookingType);
    const booking = await bookingService.findPayable(
      payment.bookingId.toString(),
    );
    this.assertPayable(booking.status, booking.holdExpiresAt);

    if (payment.status === PaymentStatus.PENDING) {
      try {
        await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
      } catch (err) {
        this.logger.warn(
          `Could not cancel previous PaymentIntent for payment ${payment.id}`,
        );
      }
    }
    payment.status = PaymentStatus.CANCELLED;
    await payment.save();

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(booking.amount * 100),
        currency: payment.currency.toLowerCase(),
        metadata: {
          bookingType: payment.bookingType,
          bookingId: payment.bookingId.toString(),
        },
      },
      {
        idempotencyKey: `payment-retry-${payment.bookingType}-${payment.bookingId}-${Date.now()}`,
      },
    );

    const newPayment = await this.paymentModel.create({
      bookingType: payment.bookingType,
      bookingId: payment.bookingId,
      userId,
      providerId: payment.providerId,
      stripePaymentIntentId: intent.id,
      amount: booking.amount,
      currency: payment.currency,
      status: PaymentStatus.PENDING,
    });

    return { paymentId: newPayment.id, clientSecret: intent.client_secret };
  }

  // PAY-01: owner or admin only
  async getPayment(userId: string, paymentId: string, isAdmin: boolean) {
    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (!isAdmin && payment.userId.toString() !== userId) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  // PAY-01: Stripe webhook, verified by raw body + signature, idempotent per event id
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.get<string>('stripe.webhookSecret') ?? '',
      );
    } catch (err) {
      throw new BadRequestException('Invalid Stripe signature');
    }

    try {
      await this.processedEventModel.create({ stripeEventId: event.id });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return; // already processed; Stripe is retrying a delivery
      }
      throw err;
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.onPaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.onPaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.canceled':
        await this.onPaymentCancelled(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        break;
    }
  }

  private assertPayable(status: BookingStatus, holdExpiresAt: Date | null) {
    if (status !== BookingStatus.PENDING_PAYMENT) {
      throw new ConflictException('Booking is not awaiting payment');
    }
    if (!holdExpiresAt || holdExpiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Hold has expired');
    }
  }

  private async onPaymentSucceeded(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentModel
      .findOne({ stripePaymentIntentId: intent.id })
      .exec();
    if (!payment || payment.status !== PaymentStatus.PENDING) return;

    payment.status = PaymentStatus.SUCCEEDED;
    await payment.save();

    const bookingService = this.bookingServiceFor(payment.bookingType);
    const confirmed = await bookingService.confirmAfterPayment(
      payment.bookingId.toString(),
      payment.id,
    );

    if (!confirmed) {
      // Hold expired/cancelled before this payment landed: refund in full.
      try {
        await this.stripe.refunds.create({ payment_intent: intent.id });
      } catch (err) {
        this.logger.error(
          `Refund after late payment failed for payment ${payment.id}`,
          err as Error,
        );
      }
      return;
    }

    await this.notifications.notify({
      userId: payment.userId.toString(),
      type: 'PAYMENT_SUCCEEDED',
      title: 'Booking confirmed',
      message: `Your ${payment.bookingType} booking is confirmed.`,
      related: {
        type: `${payment.bookingType}-booking`,
        id: payment.bookingId.toString(),
      },
    });
  }

  private async onPaymentFailed(intent: Stripe.PaymentIntent) {
    await this.paymentModel
      .updateOne(
        { stripePaymentIntentId: intent.id, status: PaymentStatus.PENDING },
        { status: PaymentStatus.FAILED },
      )
      .exec();
  }

  private async onPaymentCancelled(intent: Stripe.PaymentIntent) {
    await this.paymentModel
      .updateOne(
        { stripePaymentIntentId: intent.id, status: PaymentStatus.PENDING },
        { status: PaymentStatus.CANCELLED },
      )
      .exec();
  }
}
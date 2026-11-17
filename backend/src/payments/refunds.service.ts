import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { FLIGHT_BOOKING_EVENTS } from '../flight-bookings/flight-bookings.events';
import type {
  FlightBookingCancelledEvent,
  FlightBookingExpiredEvent,
} from '../flight-bookings/flight-bookings.events';
import { HOTEL_BOOKING_EVENTS } from '../hotel-bookings/hotel-bookings.events';
import type {
  HotelBookingCancelledEvent,
  HotelBookingExpiredEvent,
} from '../hotel-bookings/hotel-bookings.events';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BookingType,
  PaymentStatus,
  RefundStatus,
} from './enums/payment.enums';
import { calculateRefund, fromAirlineTiers } from './refund-calculator';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Refund, RefundDocument } from './schemas/refund.schema';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  private readonly stripe: Stripe | null;

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set: refunds will not be issued until it is configured',
      );
      this.stripe = null;
    }
  }

  // PAY-03: a Confirmed flight booking was cancelled (by the user, FLT-26, or the airline, FLT-06).
  @OnEvent(FLIGHT_BOOKING_EVENTS.CANCELLED)
  async handleFlightCancelled(event: FlightBookingCancelledEvent) {
    if (!event.paymentId) return;

    const payment = await this.paymentModel.findById(event.paymentId).exec();
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) return;

    const result = calculateRefund({
      tiers: fromAirlineTiers(event.cancellationTiers),
      bookingAmount: event.amount,
      cancellationAnchor: event.cancellationAnchor,
      providerInitiated: event.cancelledBy === 'airline',
    });

    const refund = await this.refundModel.create({
      paymentId: payment._id,
      bookingType: BookingType.FLIGHT,
      bookingId: event.bookingId,
      userId: event.userId,
      amount: result.amount,
      percent: result.percent,
      status: RefundStatus.PENDING,
      reason:
        event.cancelledBy === 'airline'
          ? 'Cancelled by airline'
          : 'Cancelled by user',
    });

    await this.finishRefund(refund, payment, event.userId, event.currency, 'flight', event.bookingId);
  }

  // FLT-22: a hold expired before payment; cancel the open Stripe PaymentIntent.
  @OnEvent(FLIGHT_BOOKING_EVENTS.EXPIRED)
  async handleFlightExpired(event: FlightBookingExpiredEvent) {
    await this.cancelOpenIntent(event.paymentId);
  }

  // HTL-21: a Confirmed hotel reservation was cancelled (by the user, or the hotel).
  @OnEvent(HOTEL_BOOKING_EVENTS.CANCELLED)
  async handleHotelCancelled(event: HotelBookingCancelledEvent) {
    if (!event.paymentId) return;

    const payment = await this.paymentModel.findById(event.paymentId).exec();
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) return;

    const result = calculateRefund({
      tiers: fromAirlineTiers(event.cancellationTiers),
      bookingAmount: event.amount,
      cancellationAnchor: event.cancellationAnchor,
      providerInitiated: event.cancelledBy === 'hotel',
    });

    const refund = await this.refundModel.create({
      paymentId: payment._id,
      bookingType: BookingType.HOTEL,
      bookingId: event.bookingId,
      userId: event.userId,
      amount: result.amount,
      percent: result.percent,
      status: RefundStatus.PENDING,
      reason:
        event.cancelledBy === 'hotel'
          ? 'Cancelled by hotel'
          : 'Cancelled by user',
    });

    await this.finishRefund(refund, payment, event.userId, event.currency, 'hotel', event.bookingId);
  }

  // HTL-18: a hold expired before payment; cancel the open Stripe PaymentIntent.
  @OnEvent(HOTEL_BOOKING_EVENTS.EXPIRED)
  async handleHotelExpired(event: HotelBookingExpiredEvent) {
    await this.cancelOpenIntent(event.paymentId);
  }

  private async finishRefund(
    refund: RefundDocument,
    payment: PaymentDocument,
    userId: string,
    currency: string,
    bookingType: 'flight' | 'hotel',
    bookingId: string,
  ) {
    if (refund.amount <= 0) {
      refund.status = RefundStatus.REFUNDED;
      await refund.save();
      return;
    }

    if (!this.stripe) {
      this.logger.error(
        `Cannot issue refund for ${bookingType} booking ${bookingId}: Stripe is not configured`,
      );
      refund.status = RefundStatus.FAILED;
      await refund.save();
      return;
    }

    try {
      const stripeRefund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refund.amount * 100),
      });
      refund.stripeRefundId = stripeRefund.id;
      refund.status = RefundStatus.REFUNDED;
      await refund.save();

      await this.notifications.notify({
        userId,
        type: 'REFUND_ISSUED',
        title: 'Refund issued',
        message: `A refund of ${refund.amount} ${currency} was issued for your cancelled ${bookingType} booking.`,
        related: { type: `${bookingType}-booking`, id: bookingId },
      });
    } catch (err) {
      this.logger.error(
        `Stripe refund failed for ${bookingType} booking ${bookingId}`,
        err as Error,
      );
      refund.status = RefundStatus.FAILED;
      await refund.save();
    }
  }

  private async cancelOpenIntent(paymentId: string | undefined) {
    if (!paymentId) return;

    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment || payment.status !== PaymentStatus.PENDING) return;

    if (this.stripe) {
      try {
        await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
      } catch (err) {
        this.logger.error(
          `Failed to cancel Stripe PaymentIntent for payment ${payment.id}`,
          err as Error,
        );
      }
    } else {
      this.logger.warn(
        `Cannot cancel Stripe PaymentIntent for payment ${payment.id}: Stripe is not configured`,
      );
    }

    payment.status = PaymentStatus.CANCELLED;
    await payment.save();
  }
}
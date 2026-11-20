import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { FLIGHT_BOOKING_EVENTS } from '../flight-bookings/flight-bookings.events';
import type {
  FlightBookingCancelledEvent,
  FlightBookingChangeExpiredEvent,
  FlightBookingExpiredEvent,
  FlightBookingFareReducedEvent,
  FlightBookingRefundProcessedEvent,
} from '../flight-bookings/flight-bookings.events';
import { HOTEL_BOOKING_EVENTS } from '../hotel-bookings/hotel-bookings.events';
import type {
  HotelBookingCancelledEvent,
  HotelBookingExpiredEvent,
  HotelBookingRefundProcessedEvent,
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
    private readonly events: EventEmitter2,
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

  // PAY-03: get a refund by id (owner or admin only)
  async getRefund(userId: string, id: string, isAdmin = false) {
    const refund = await this.refundModel.findById(id).exec();
    if (!refund) {
      throw new NotFoundException('Refund not found');
    }
    if (!isAdmin && refund.userId.toString() !== userId) {
      throw new NotFoundException('Refund not found');
    }
    return refund;
  }

  /**
   * FLT-27 / PAY-01: called by PaymentsService when a payment succeeded but its booking or
   * change could no longer be applied (expired hold, cancelled in the meantime, etc.) — the
   * interface contract calls for a full refund either way.
   */
  async refundEntirePayment(
    payment: PaymentDocument,
    bookingType: BookingType,
    bookingId: string,
    reason: string,
  ) {
    if (payment.status !== PaymentStatus.SUCCEEDED) return;

    const refund = await this.refundModel.create({
      paymentId: payment._id,
      bookingType,
      bookingId,
      userId: payment.userId,
      amount: payment.amount,
      percent: 100,
      status: RefundStatus.PENDING,
      reason,
    });

    await this.finishRefund(
      refund,
      payment,
      payment.userId.toString(),
      payment.currency,
      bookingType === BookingType.FLIGHT ? 'flight' : 'hotel',
      bookingId,
    );
  }

  // PAY-03: a Confirmed flight booking was cancelled (by the user, FLT-26, or the airline, FLT-06).
  // FLT-27: the amount paid may now be split across the original payment and one or more
  // price-difference payments (extraPaymentIds), so the refund is spread across them, newest first,
  // never refunding more than what each payment has left (accounting for refunds already issued
  // against it, e.g. by a FARE_REDUCED event).
  @OnEvent(FLIGHT_BOOKING_EVENTS.CANCELLED)
  async handleFlightCancelled(event: FlightBookingCancelledEvent) {
    const result = calculateRefund({
      tiers: fromAirlineTiers(event.cancellationTiers),
      bookingAmount: event.amount,
      cancellationAnchor: event.cancellationAnchor,
      providerInitiated: event.cancelledBy === 'airline',
    });
    let remainingTotal = result.amount;
    if (remainingTotal <= 0) return;

    const paymentIds = [...(event.extraPaymentIds ?? []), event.paymentId].filter(
      (id): id is string => !!id,
    );

    for (const paymentId of paymentIds) {
      if (remainingTotal <= 0) break;

      const payment = await this.paymentModel.findById(paymentId).exec();
      if (!payment || payment.status !== PaymentStatus.SUCCEEDED) continue;

      const refundedAgg = await this.refundModel.aggregate([
        { $match: { paymentId: payment._id, status: { $ne: RefundStatus.FAILED } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const refundedSoFar = refundedAgg[0]?.total ?? 0;
      const remainingOnPayment = payment.amount - refundedSoFar;
      if (remainingOnPayment <= 0) continue;

      const refundAmount = Math.min(remainingOnPayment, remainingTotal);

      const refund = await this.refundModel.create({
        paymentId: payment._id,
        bookingType: BookingType.FLIGHT,
        bookingId: event.bookingId,
        userId: event.userId,
        amount: refundAmount,
        percent: result.percent,
        status: RefundStatus.PENDING,
        reason:
          event.cancelledBy === 'airline'
            ? 'Cancelled by airline'
            : 'Cancelled by user',
      });

      await this.finishRefund(refund, payment, event.userId, event.currency, 'flight', event.bookingId);
      remainingTotal -= refundAmount;
    }
  }

  // FLT-22: a hold expired before payment; cancel the open Stripe PaymentIntent.
  @OnEvent(FLIGHT_BOOKING_EVENTS.EXPIRED)
  async handleFlightExpired(event: FlightBookingExpiredEvent) {
    await this.cancelOpenIntent(event.paymentId);
  }

  // FLT-27: the user moved to a cheaper flight; the booking total already went down, so refund
  // the price difference (100%, no cancellation tiers) against the original payment.
  @OnEvent(FLIGHT_BOOKING_EVENTS.FARE_REDUCED)
  async handleFlightFareReduced(event: FlightBookingFareReducedEvent) {
    if (!event.paymentId) return;

    const payment = await this.paymentModel.findById(event.paymentId).exec();
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) return;

    const refund = await this.refundModel.create({
      paymentId: payment._id,
      bookingType: BookingType.FLIGHT,
      bookingId: event.bookingId,
      userId: event.userId,
      amount: event.amount,
      percent: 100,
      status: RefundStatus.PENDING,
      reason: 'Cheaper flight: price difference',
    });

    await this.finishRefund(
      refund,
      payment,
      event.userId,
      event.currency,
      'flight',
      event.bookingId,
      `fare-reduced-${event.bookingId}-${event.changedAt.getTime()}`,
    );
  }

  // FLT-27: an unpaid change to a dearer flight ended without payment (10 minutes passed, the
  // user cancelled it, or the whole booking was cancelled) — cancel its open PaymentIntent(s).
  @OnEvent(FLIGHT_BOOKING_EVENTS.CHANGE_EXPIRED)
  async handleFlightChangeExpired(event: FlightBookingChangeExpiredEvent) {
    const payments = await this.paymentModel
      .find({
        bookingType: BookingType.FLIGHT,
        bookingId: event.bookingId,
        changeId: event.changeId,
        status: PaymentStatus.PENDING,
      })
      .exec();

    for (const payment of payments) {
      if (this.stripe) {
        try {
          await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
        } catch (err) {
          this.logger.error(
            `Failed to cancel Stripe PaymentIntent for expired flight change ${event.changeId}`,
            err as Error,
          );
        }
      } else {
        this.logger.warn(
          `Cannot cancel Stripe PaymentIntent for expired flight change ${event.changeId}: Stripe is not configured`,
        );
      }
      payment.status = PaymentStatus.CANCELLED;
      await payment.save();
    }
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
    idempotencyKey?: string,
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
      const stripeRefund = await this.stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId,
          amount: Math.round(refund.amount * 100),
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );
      refund.stripeRefundId = stripeRefund.id;
      refund.status = RefundStatus.REFUNDED;
      await refund.save();

      // PAY-03: reflect the refund on the payment itself — previously nothing updated
      // payment.status/refundedAmount, so a refunded payment still looked SUCCEEDED forever.
      payment.refundedAmount = (payment.refundedAmount ?? 0) + refund.amount;
      payment.status =
        payment.refundedAmount >= payment.amount
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      await payment.save();

      // PAY-03: tell the booking module the confirmed refund result — previously nothing wrote
      // this back, so cancellation.refundId/refundAmount/refundPercentage stayed null forever.
      if (bookingType === 'flight') {
        const flightEvent: FlightBookingRefundProcessedEvent = {
          bookingId,
          refundId: refund.id,
          refundAmount: refund.amount,
          refundPercent: refund.percent,
        };
        this.events.emit(FLIGHT_BOOKING_EVENTS.REFUND_PROCESSED, flightEvent);
      } else if (bookingType === 'hotel') {
        // PAY-03: same write-back for hotel bookings — cancel() only ever set a pre-calculated
        // preview; this overwrites it with the Stripe-confirmed amount/percent and sets refundId.
        const hotelEvent: HotelBookingRefundProcessedEvent = {
          bookingId,
          refundId: refund.id,
          refundAmount: refund.amount,
          refundPercent: refund.percent,
        };
        this.events.emit(HOTEL_BOOKING_EVENTS.REFUND_PROCESSED, hotelEvent);
      }

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
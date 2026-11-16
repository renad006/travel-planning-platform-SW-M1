import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import {
  FLIGHT_BOOKING_EVENTS,
} from '../flight-bookings/flight-bookings.events';
import type {
  FlightBookingCancelledEvent,
  FlightBookingExpiredEvent,
} from '../flight-bookings/flight-bookings.events';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingType, PaymentStatus, RefundStatus } from './enums/payment.enums';
import { calculateRefund, fromAirlineTiers } from './refund-calculator';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Refund, RefundDocument } from './schemas/refund.schema';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('stripe.secretKey') ?? '');
  }

  // PAY-03: a Confirmed flight booking was cancelled (by the user, FLT-26, or the airline, FLT-06).
  @OnEvent(FLIGHT_BOOKING_EVENTS.CANCELLED)
  async handleFlightCancelled(event: FlightBookingCancelledEvent) {
    // Nothing was ever charged, so there's nothing to refund.
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

    if (result.amount <= 0) {
      refund.status = RefundStatus.REFUNDED;
      await refund.save();
      return;
    }

    try {
      const stripeRefund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(result.amount * 100),
      });
      refund.stripeRefundId = stripeRefund.id;
      refund.status = RefundStatus.REFUNDED;
      await refund.save();

      await this.notifications.notify({
        userId: event.userId,
        type: 'REFUND_ISSUED',
        title: 'Refund issued',
        message: `A refund of ${result.amount} ${event.currency} was issued for your cancelled flight booking.`,
        related: { type: 'flight-booking', id: event.bookingId },
      });
    } catch (err) {
      this.logger.error(
        `Stripe refund failed for booking ${event.bookingId}`,
        err as Error,
      );
      refund.status = RefundStatus.FAILED;
      await refund.save();
    }
  }

  // FLT-22: a hold expired before payment; cancel the open Stripe PaymentIntent.
  @OnEvent(FLIGHT_BOOKING_EVENTS.EXPIRED)
  async handleFlightExpired(event: FlightBookingExpiredEvent) {
    if (!event.paymentId) return;

    const payment = await this.paymentModel.findById(event.paymentId).exec();
    if (!payment || payment.status !== PaymentStatus.PENDING) return;

    try {
      await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
    } catch (err) {
      this.logger.error(
        `Failed to cancel Stripe PaymentIntent for booking ${event.bookingId}`,
        err as Error,
      );
    }

    payment.status = PaymentStatus.CANCELLED;
    await payment.save();
  }
}
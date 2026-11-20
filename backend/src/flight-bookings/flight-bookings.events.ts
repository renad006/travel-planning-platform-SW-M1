/**
 * Events emitted by the flight-bookings module.
 *
 * Member 5 (payments) listens with @OnEvent(...) so this module never has to import payment
 * code, and payments never has to poll bookings.
 */
export const FLIGHT_BOOKING_EVENTS = {
  /** FLT-26 / FLT-06: a Confirmed booking was cancelled. Member 5 calculates and issues the refund (PAY-03). */
  CANCELLED: 'flight-booking.cancelled',
  /** FLT-22: a Pending Payment hold expired. Member 5 cancels the Stripe PaymentIntent (PAY-01). */
  EXPIRED: 'flight-booking.expired',
  /**
   * FLT-27: the user moved to a CHEAPER flight. The booking total already went down; Member 5
   * refunds `amount` (the whole difference, no cancellation tier) to the original payment.
   */
  FARE_REDUCED: 'flight-booking.fare-reduced',
  /**
   * FLT-27: a change to a dearer flight that waited for payment ended WITHOUT being paid (the 10
   * minutes ran out, or the user cancelled it, or the booking was cancelled). Member 5 cancels
   * the open PaymentIntent of that change.
   */
  CHANGE_EXPIRED: 'flight-booking.change-expired',
  /**
   * PAY-03: Payments finished processing a refund for this booking (fired once per payment
   * refunded — FLT-27 can split one cancellation's refund across several payments).
   */
  REFUND_PROCESSED: 'flight-booking.refund-processed',
} as const;

export interface FlightBookingChangeExpiredEvent {
  bookingId: string;
  userId: string;
  /** The pending change: Payments finds its open PaymentIntent with it. */
  changeId: string;
  reason: 'expired' | 'cancelled';
}

export interface FlightBookingFareReducedEvent {
  bookingId: string;
  userId: string;
  reference: string;
  /** Payment document (Member 5) the difference goes back to. */
  paymentId?: string;
  /** Amount to refund (the price difference), already in the platform currency. */
  amount: number;
  currency: string;
  /** Time of the change. */
  changedAt: Date;
}

export interface FlightBookingCancelledEvent {
  bookingId: string;
  userId: string;
  reference: string;
  /** Payment document (Member 5) that has to be refunded. */
  paymentId?: string;
  /**
   * FLT-27: payments of price differences (a change to a dearer flight). Each one is refunded
   * with the same rules. Absent/empty when the booking was never changed to a dearer flight.
   * `amount` below is the TOTAL paid (booking price now = first payment + these).
   */
  extraPaymentIds?: string[];
  /** 'airline' = FLT-06, Payments refunds 100%. 'user' = FLT-26, Payments applies the tiers. */
  cancelledBy: 'user' | 'airline';
  /** Amount that was paid (FlightBooking.totalPrice). */
  amount: number;
  currency: string;
  /** Outbound departure: the refund tier is chosen from the days left until then. */
  cancellationAnchor: Date;
  cancellationTiers: {
    daysBeforeDeparture: number;
    refundPercentage: number;
  }[];
}

export interface FlightBookingExpiredEvent {
  bookingId: string;
  userId: string;
  paymentId?: string;
}

/** PAY-03: the confirmed outcome of a single refund issued against one of this booking's payments. */
export interface FlightBookingRefundProcessedEvent {
  bookingId: string;
  refundId: string;
  refundAmount: number;
  refundPercent: number;
}
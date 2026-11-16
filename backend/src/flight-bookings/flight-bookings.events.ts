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
} as const;

export interface FlightBookingCancelledEvent {
  bookingId: string;
  userId: string;
  reference: string;
  /** Payment document (Member 5) that has to be refunded. */
  paymentId?: string;
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

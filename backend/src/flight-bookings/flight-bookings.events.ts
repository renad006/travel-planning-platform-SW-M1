/**
 * Events emitted by the flight-bookings module.
 *
 * Member 5 (payments) listens with @OnEvent(...) so this module never has to import payment
 * code, and payments never has to poll bookings.
 */
export const FLIGHT_BOOKING_EVENTS = {
  /** FLT-22: a Pending Payment hold expired. Member 5 cancels the Stripe PaymentIntent (PAY-01). */
  EXPIRED: 'flight-booking.expired',
} as const;

export interface FlightBookingExpiredEvent {
  bookingId: string;
  userId: string;
  paymentId?: string;
}

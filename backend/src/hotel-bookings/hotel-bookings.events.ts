/**
 * Events emitted by the hotel-bookings module, same shape as flight-bookings.events.ts.
 *
 * Member 5 (payments) listens with @OnEvent(...) so this module never imports payment
 * code and payments never polls bookings.
 */
export const HOTEL_BOOKING_EVENTS = {
  /** HTL-21: a Confirmed reservation was cancelled. Payments calculates and issues the refund (PAY-03). */
  CANCELLED: 'hotel-booking.cancelled',
  /** HTL-18: a Pending Payment hold expired. Payments cancels the Stripe PaymentIntent (PAY-01). */
  EXPIRED: 'hotel-booking.expired',
} as const;

export interface HotelBookingCancelledEvent {
  bookingId: string;
  userId: string;
  reference: string;
  /** Payment document (Member 5) that has to be refunded. */
  paymentId?: string;
  /** 'user' = HTL-21, Payments applies the tiers. 'hotel' = hotel cancels, Payments refunds 100%. */
  cancelledBy: 'user' | 'hotel';
  /** Amount that was paid (HotelBooking.totalPrice). */
  amount: number;
  currency: string;
  /** Check-in date: the refund tier is chosen from the days left until then. */
  cancellationAnchor: Date;
  cancellationTiers: {
    daysBeforeDeparture: number;
    refundPercentage: number;
  }[];
}

export interface HotelBookingExpiredEvent {
  bookingId: string;
  userId: string;
  paymentId?: string;
}

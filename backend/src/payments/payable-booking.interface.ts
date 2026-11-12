import { BookingStatus } from '../common/enums/booking-status.enum';
import { BookingType } from './enums/payment.enums';

/**
 * Booking contract between Payments (Member 5) and the booking modules
 * (Member 3 = flights, Member 4 = hotels).
 *
 * Payments never reads or writes booking collections directly. It only calls
 * the three methods below, so each booking module keeps ownership of its schema.
 */

/** What Payments needs to know about a booking. Flights map from FlightBooking. */
export interface PayableBooking {
  id: string;
  type: BookingType;
  /** FlightBooking.userId */
  ownerId: string;
  /** FlightBooking.airlineId (hotel: hotel id) */
  providerId: string;
  /** FlightBooking.totalPrice, in the platform currency (PAY-04) */
  amount: number;
  /** FlightBooking.currency */
  currency: string;
  status: BookingStatus;
  /** FlightBooking.holdExpiresAt (null when not pending) */
  holdExpiresAt: Date | null;
  /** FlightBooking.policiesAcceptedAt (PAY-02); null until accepted */
  policiesAcceptedAt: Date | null;
  /** Flight: outbound departureTime. Hotel: check-in. Used for refund tiers. */
  cancellationAnchor: Date;
  /** Same shape as FlightBooking.policiesSnapshot.cancellationTiers (FLT-09, HTL-10). */
  cancellationTiers: { daysBeforeDeparture: number; refundPercentage: number }[];
  /** The policies shown to the user (PAY-02): airline = cancellation + baggage, hotel = cancellation + check-in/out. */
  policySnapshot: Record<string, unknown>;
}

/**
 * Each booking service (FlightBookingsService, HotelBookingsService) implements this.
 * Method names are fixed; internals are the booking owner's choice.
 */
export interface PayableBookingService {
  /** Throws NotFoundException when the booking does not exist. No ownership check: Payments does it. */
  findPayable(id: string): Promise<PayableBooking>;

  /**
   * Called by the Stripe webhook after payment_intent.succeeded (PAY-01).
   * Must be ATOMIC: only a booking still in PENDING_PAYMENT becomes CONFIRMED
   * (e.g. findOneAndUpdate with status in the filter). Also sets confirmedAt,
   * paymentId and generates the reference / e-ticket (FLT-23).
   * Returns true if it confirmed, false if the booking was no longer pending
   * (expired or cancelled). On false, Payments refunds the customer 100%.
   */
  confirmAfterPayment(id: string, paymentId: string): Promise<boolean>;

  /**
   * Hold expiry job (FLT-22): PENDING_PAYMENT -> EXPIRED, release seats / rooms.
   * After expiring, the booking service calls
   * PaymentsService.cancelIntentForBooking(type, id) so the open
   * PaymentIntent is cancelled in Stripe.
   */
  expireHold(id: string): Promise<void>;

  /** PAY-02: Payments saves the acceptance record, then calls this to store the timestamp on the booking. */
  markPoliciesAccepted(id: string, acceptedAt: Date): Promise<void>;
}

/**
 * Injection tokens. Each booking module must export a provider under its token:
 *   { provide: PAYABLE_FLIGHT_BOOKINGS, useExisting: FlightBookingsService }
 *   { provide: PAYABLE_HOTEL_BOOKINGS,  useExisting: HotelBookingsService }
 */
export const PAYABLE_FLIGHT_BOOKINGS = 'PAYABLE_FLIGHT_BOOKINGS';
export const PAYABLE_HOTEL_BOOKINGS = 'PAYABLE_HOTEL_BOOKINGS';
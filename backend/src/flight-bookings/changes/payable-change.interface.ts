import { BookingStatus } from '../../common/enums/booking-status.enum';

/**
 * FLT-27: contract between Payments (Member 5) and the flight changes of Member 3, for a change to
 * a DEARER flight (the user pays the price difference).
 *
 * Same idea as payments/payable-booking.interface.ts: Payments never reads the booking collection,
 * it only calls the two methods below (injected with the PAYABLE_FLIGHT_CHANGES token).
 */

/** What Payments needs to know to charge the price difference of one pending change. */
export interface PayableFlightChange {
  /** The booking id. */
  bookingId: string;
  /** Id of the pending change (the user can only have one at a time). */
  changeId: string;
  /** FlightBooking.userId (Payments checks the owner). */
  ownerId: string;
  /** FlightBooking.airlineId */
  providerId: string;
  /** The price difference to charge (NOT the booking total), in the booking currency. */
  amount: number;
  currency: string;
  status: BookingStatus;
  /** The new flight's seats are held until then; a payment that succeeds after it is not applied. */
  holdExpiresAt: Date;
  reference: string;
  /** For the receipt / payment description. */
  description: string;
}

export interface PayableFlightChangeService {
  /**
   * Throws NotFoundException when the booking does not exist, or has no pending change with this
   * id any more (paid, cancelled or expired). No ownership check: Payments does it.
   */
  findPayableChange(bookingId: string, changeId: string): Promise<PayableFlightChange>;

  /**
   * Called by the Stripe webhook after the difference was paid. ATOMIC and safe to call twice.
   * Moves the booking to the new flight, makes the held seats booked, returns the old seats and
   * stores `paymentId` on the booking (extraPaymentIds).
   * Returns true when this payment paid the change (also for a redelivery of the SAME payment).
   * Returns false when the change is no longer waiting (expired, cancelled, flight unavailable):
   * then Payments must refund this payment 100%.
   */
  confirmChangeAfterPayment(
    bookingId: string,
    changeId: string,
    paymentId: string,
  ): Promise<boolean>;
}

/** Injection token. FlightBookingsModule exports { provide: PAYABLE_FLIGHT_CHANGES, useExisting: FlightChangesService }. */
export const PAYABLE_FLIGHT_CHANGES = 'PAYABLE_FLIGHT_CHANGES';

import {
  ageOnDate,
  fareCentsFor,
  fromCents,
  passengerTypeForAge,
} from '../flight-bookings.rules';
import { PassengerType, SegmentDirection } from '../schemas/flight-booking.enums';

/**
 * FLT-27: pure rules of changing a flight (no database, no Nest), so they are easy to unit-test.
 */

export interface ChangePassenger {
  type: PassengerType;
  fullName: string;
  dateOfBirth: Date;
  extraBags: number;
  extraBagWeightKg: number;
}

export type FareDirection = 'pay' | 'refund' | 'none';

export interface FareDifference {
  /** Always positive (or 0). */
  amount: number;
  /** pay = the new flight is dearer, refund = cheaper, none = same price. */
  direction: FareDirection;
}

/** Fare of the whole booking on one flight: adults and children pay the fare, infants 10%. */
export function segmentFareCents(
  passengers: ReadonlyArray<Pick<ChangePassenger, 'type'>>,
  cabinFareCents: number,
): number {
  return passengers.reduce((sum, p) => sum + fareCentsFor(p.type, cabinFareCents), 0);
}

/** New fare minus the fare paid for that flight, in integer cents. */
export function fareDifference(paidCents: number, newCents: number): FareDifference {
  const diff = newCents - paidCents;
  return {
    amount: fromCents(Math.abs(diff)),
    direction: diff > 0 ? 'pay' : diff < 0 ? 'refund' : 'none',
  };
}

/**
 * Passenger types are fixed on the OUTBOUND departure date (FLT-12b). When the outbound flight
 * moves to another date, anyone whose age group would change blocks the change (an infant turning
 * 2 would become a child with a seat and a full fare).
 */
export function passengersWhoseTypeWouldChange(
  passengers: ReadonlyArray<Pick<ChangePassenger, 'type' | 'fullName' | 'dateOfBirth'>>,
  newOutboundLocalDate: string,
): string[] {
  return passengers
    .filter(
      (p) =>
        passengerTypeForAge(ageOnDate(new Date(p.dateOfBirth), newOutboundLocalDate)) !== p.type,
    )
    .map((p) => p.fullName);
}

/** Extra bag weight must still fit the new flight's per-bag limit. */
export function passengersOverBagLimit(
  passengers: ReadonlyArray<Pick<ChangePassenger, 'fullName' | 'extraBags' | 'extraBagWeightKg'>>,
  maxWeightKgPerBag: number,
): string[] {
  return passengers
    .filter((p) => (p.extraBagWeightKg ?? 0) > (p.extraBags ?? 0) * maxWeightKgPerBag)
    .map((p) => p.fullName);
}

interface Times {
  departureTime: Date;
  arrivalTime: Date;
}

/**
 * Round trips (FLT-12a): the return flight leaves after the outbound lands. `other` is the flight
 * of the segment that is NOT being changed. Returns a message, or null when the order is fine.
 */
export function segmentOrderProblem(
  changing: SegmentDirection,
  candidate: Times,
  other: Times | null,
): string | null {
  if (!other) return null; // one-way booking
  if (changing === SegmentDirection.OUTBOUND) {
    return candidate.arrivalTime.getTime() >= other.departureTime.getTime()
      ? 'It would land after your return flight departs'
      : null;
  }
  return candidate.departureTime.getTime() <= other.arrivalTime.getTime()
    ? 'It would depart before your outbound flight lands'
    : null;
}

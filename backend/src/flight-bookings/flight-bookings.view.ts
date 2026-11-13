import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { maskPassport } from './flight-bookings.rules';
import {
  FlightBooking,
  FlightSegment,
  Passenger,
} from './schemas/flight-booking.schema';

/** A booking as read from the database (plain object, with the Mongoose extras). */
export type BookingRecord = FlightBooking & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
type PassengerRecord = Passenger & { _id?: Types.ObjectId };

export interface AirportInfo {
  iataCode: string;
  name: string;
  timeZone: string;
}
export type AirportMap = Map<string, AirportInfo>;

/** GEN-06: show a UTC instant in an airport's local time zone (ISO string with offset). */
export function localTime(instant: Date, timeZone?: string): string {
  const utc = DateTime.fromJSDate(instant, { zone: 'utc' });
  const local = timeZone ? utc.setZone(timeZone) : utc;
  return (local.isValid ? local : utc).toISO() ?? instant.toISOString();
}

function airportView(code: string, airports: AirportMap) {
  const a = airports.get(code);
  return {
    iataCode: code,
    name: a?.name ?? null,
    timeZone: a?.timeZone ?? 'UTC',
  };
}

export function toSegmentView(seg: FlightSegment, airports: AirportMap) {
  const origin = airportView(seg.originAirport, airports);
  const destination = airportView(seg.destinationAirport, airports);
  return {
    direction: seg.direction,
    flightId: seg.flightId.toString(),
    flightNumber: seg.flightNumber,
    cabinClass: seg.cabinClass,
    origin,
    destination,
    departureTime: seg.departureTime,
    departureLocal: localTime(seg.departureTime, origin.timeZone),
    arrivalTime: seg.arrivalTime,
    arrivalLocal: localTime(seg.arrivalTime, destination.timeZone),
    durationMinutes: Math.round(
      (seg.arrivalTime.getTime() - seg.departureTime.getTime()) / 60000,
    ),
    farePerSeat: seg.farePerSeat,
    fareSubtotal: seg.fareSubtotal,
  };
}

export function toPassengerView(p: PassengerRecord, maskPassports: boolean) {
  return {
    id: p._id?.toString(),
    type: p.type,
    fullName: p.fullName,
    dateOfBirth: p.dateOfBirth,
    passportNumber: maskPassports
      ? maskPassport(p.passportNumber)
      : p.passportNumber,
    extraBags: p.extraBags,
    extraBagWeightKg: p.extraBagWeightKg,
    fare: p.fare,
    baggageFee: p.baggageFee,
  };
}

export function toPricingView(b: {
  currency: string;
  fareTotal: number;
  baggageTotal: number;
  totalPrice: number;
}) {
  return {
    currency: b.currency,
    fareTotal: b.fareTotal,
    baggageTotal: b.baggageTotal,
    totalPrice: b.totalPrice,
  };
}

/** The API shape of a booking. `maskPassports` is used by list views. */
export function toBookingView(
  b: BookingRecord,
  airports: AirportMap,
  options: { maskPassports?: boolean } = {},
) {
  const now = Date.now();
  const holdActive = b.status === 'pending_payment' && b.holdExpiresAt;
  return {
    id: b._id.toString(),
    reference: b.reference ?? null,
    eTicketNumber: b.eTicketNumber ?? null,
    status: b.status,
    tripType: b.tripType,
    airlineId: b.airlineId.toString(),
    segments: b.segments.map((s) => toSegmentView(s, airports)),
    passengers: b.passengers.map((p) =>
      toPassengerView(p, options.maskPassports ?? false),
    ),
    seatCount: b.seatCount,
    pricing: toPricingView(b),
    holdExpiresAt: b.holdExpiresAt ?? null,
    secondsUntilHoldExpiry: holdActive
      ? Math.max(0, Math.round((b.holdExpiresAt!.getTime() - now) / 1000))
      : null,
    policies: b.policiesSnapshot ?? null,
    policiesAcceptedAt: b.policiesAcceptedAt ?? null,
    paymentId: b.paymentId?.toString() ?? null,
    confirmedAt: b.confirmedAt ?? null,
    cancellation: b.cancelledAt
      ? {
          cancelledAt: b.cancelledAt,
          cancelledBy: b.cancelledBy ?? null,
          reason: b.cancellationReason ?? null,
          refundPercentage: b.refundPercentage ?? null,
          refundAmount: b.refundAmount ?? null,
          refundId: b.refundId?.toString() ?? null,
        }
      : null,
    createdAt: b.createdAt ?? null,
  };
}

export type BookingView = ReturnType<typeof toBookingView>;

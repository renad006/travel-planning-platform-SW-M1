import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../common/enums/booking-status.enum';
import {
  FlightBooking,
  FlightBookingDocument,
} from '../flight-bookings/schemas/flight-booking.schema';

/** One booking row on a flight, as FLT-29 needs it. */
export interface FlightBookingRow {
  bookingReference: string;
  passengerNames: string[];
  cabinClass: string;
  seats: number;
  status: 'Confirmed' | 'Cancelled' | 'Completed';
}

const STATUS_LABEL: Partial<Record<BookingStatus, FlightBookingRow['status']>> = {
  [BookingStatus.CONFIRMED]: 'Confirmed',
  [BookingStatus.CANCELLED]: 'Cancelled',
  // after the flight departs, Member 3 may mark bookings Completed - they are still
  // real passengers of this flight, so the moderator list / CSV must keep them
  [BookingStatus.COMPLETED]: 'Completed',
};

/**
 * FLT-29 adapter: reads the bookings of ONE flight from Member 3's FlightBooking
 * collection.
 *
 * A round-trip booking (FLT-12a) has two segments (outbound + return) sharing the
 * same passengers. We only report the segment that matches THIS flight, so a
 * passenger shows up once per flight with that segment's cabin class - not the
 * whole booking's data twice.
 *
 * BookingStatus (common/enums/booking-status.enum.ts): pending_payment, confirmed,
 * cancelled, expired, completed.
 */
@Injectable()
export class FlightBookingsReader {
  constructor(
    @InjectModel(FlightBooking.name)
    private readonly bookingModel: Model<FlightBookingDocument>,
  ) {}

  async findByFlight(flightId: string): Promise<FlightBookingRow[]> {
    if (!/^[a-f\d]{24}$/i.test(flightId)) return [];
    const fId = new Types.ObjectId(flightId);

    const bookings = await this.bookingModel
      .find({
        'segments.flightId': fId,
        // Pending Payment / Expired are not real bookings, so they are left out
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.COMPLETED] },
      })
      .select('reference segments passengers status seatCount')
      .lean();

    const rows: FlightBookingRow[] = [];
    for (const b of bookings) {
      const segment = b.segments.find((s) => s.flightId.toString() === flightId);
      if (!segment) continue; // defensive: shouldn't happen given the query filter above
      rows.push({
        bookingReference: b.reference ?? '(no reference)',
        passengerNames: b.passengers.map((p) => p.fullName),
        cabinClass: segment.cabinClass,
        // Same adults+children travel both segments of a round trip, so seatCount
        // is correct for whichever leg (this flight) we're reporting.
        seats: b.seatCount,
        status: STATUS_LABEL[b.status] ?? 'Confirmed',
      });
    }
    return rows;
  }
}
import { Injectable } from '@nestjs/common';

/** One booking on a flight, as FLT-29 needs it. */
export interface FlightBookingRow {
  bookingReference: string;
  passengerNames: string[];
  cabinClass: string;
  seats: number;
  status: 'Confirmed' | 'Cancelled';
}

/**
 * FLT-29 adapter: reads the bookings of ONE flight from Member 3's collection.
 *
 * TODO (needs Member 3's flight-booking.schema.ts): inject their model here with
 * @InjectModel(FlightBooking.name), register it in FlightsModule's forFeature([...]),
 * query { flightId, status: { $in: ['Confirmed', 'Cancelled'] } } and map each booking
 * to a FlightBookingRow. Until then it returns an empty list (no fake data).
 */
@Injectable()
export class FlightBookingsReader {
  async findByFlight(_flightId: string): Promise<FlightBookingRow[]> {
    return [];
  }
}

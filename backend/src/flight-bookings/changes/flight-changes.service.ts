import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Airline, AirlineDocument } from '../../flights/schemas/airline.schema';
import {
  CabinInventory,
  CabinInventoryDocument,
} from '../../flights/schemas/cabin-inventory.schema';
import { Flight, FlightDocument, FlightStatus } from '../../flights/schemas/flight.schema';
import { Airport, AirportDocument } from '../../reference-data/schemas/airport.schema';
import { toCents } from '../flight-bookings.rules';
import { FlightBooking, FlightBookingDocument } from '../schemas/flight-booking.schema';
import { SegmentDirection } from '../schemas/flight-booking.enums';
import {
  fareDifference,
  passengersOverBagLimit,
  passengersWhoseTypeWouldChange,
  segmentFareCents,
  segmentOrderProblem,
} from './change-rules';

const NOT_FOUND = 'Flight booking not found';
const DEFAULT_WINDOW_DAYS = 30;
const MAX_OPTIONS = 50;
const DAY_MS = 86_400_000;

type BookingLean = FlightBooking & { _id: Types.ObjectId };
type SegmentLean = FlightBooking['segments'][number];
type FlightLean = Flight & { _id: Types.ObjectId };

/**
 * FLT-27 (bonus): changing the date or flight of a Confirmed booking.
 * A booking can only move to another flight of the SAME airline, on the SAME route and in the SAME
 * cabin. This service lists those flights (with the fare difference) so the user sees the price
 * before confirming (GEN-03); nothing is changed here.
 */
@Injectable()
export class FlightChangesService {
  constructor(
    @InjectModel(FlightBooking.name)
    private readonly bookingModel: Model<FlightBookingDocument>,
    @InjectModel(Flight.name)
    private readonly flightModel: Model<FlightDocument>,
    @InjectModel(Airline.name)
    private readonly airlineModel: Model<AirlineDocument>,
    @InjectModel(CabinInventory.name)
    private readonly cabinModel: Model<CabinInventoryDocument>,
    @InjectModel(Airport.name)
    private readonly airportModel: Model<AirportDocument>,
  ) {}

  /** The flights this booking could move to, each with the fare difference. */
  async getOptions(
    userId: string,
    id: string,
    direction: SegmentDirection = SegmentDirection.OUTBOUND,
    date?: string,
  ) {
    const ctx = await this.loadChangeable(userId, id, direction);
    const { booking, segment, other, currentFlight } = ctx;

    const paidCents = toCents(segment.fareSubtotal);
    const current = {
      flightNumber: segment.flightNumber,
      originAirport: segment.originAirport,
      destinationAirport: segment.destinationAirport,
      departureTime: segment.departureTime,
      arrivalTime: segment.arrivalTime,
      cabinClass: segment.cabinClass,
      fareSubtotal: segment.fareSubtotal,
    };
    const base = {
      bookingId: booking._id.toString(),
      segment: direction,
      currency: booking.currency,
      current,
    };

    const airline = await this.airlineModel
      .findById(currentFlight.airlineId)
      .select('isActive')
      .lean()
      .exec();
    if (!airline || !airline.isActive) {
      return { ...base, options: [] };
    }

    const now = Date.now();
    const range = date
      ? {
          // a local date can start up to ~14 h before / after its UTC day: fetch wide, filter below
          $gt: new Date(Math.max(now, Date.parse(`${date}T00:00:00Z`) - 14 * 3_600_000)),
          $lt: new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS + 14 * 3_600_000),
        }
      : { $gt: new Date(now), $lte: new Date(now + DEFAULT_WINDOW_DAYS * DAY_MS) };

    const flights = (await this.flightModel
      .find({
        airlineId: currentFlight.airlineId,
        originAirport: segment.originAirport,
        destinationAirport: segment.destinationAirport,
        status: FlightStatus.SCHEDULED,
        _id: { $ne: segment.flightId },
        departureTime: range,
      })
      .sort({ departureTime: 1 })
      .limit(MAX_OPTIONS)
      .lean()
      .exec()) as unknown as FlightLean[];

    const cabins = await this.cabinModel
      .find({ flightId: { $in: flights.map((f) => f._id) }, cabinClass: segment.cabinClass })
      .lean()
      .exec();
    const cabinOf = new Map(cabins.map((c) => [c.flightId.toString(), c]));
    const timeZone = await this.timeZoneOf(segment.originAirport);

    const options = flights
      // a flight without a cabin of the booked class cannot be an option at all
      .filter((flight) => cabinOf.has(flight._id.toString()))
      .map((flight) => ({ flight, localDate: this.localDateOf(flight, timeZone) }))
      .filter(({ localDate }) => !date || localDate === date)
      .map(({ flight, localDate }) => {
        const cabin = cabinOf.get(flight._id.toString());
        const reasons: string[] = [];
        let seatsLeft = 0;
        let newFare = 0;
        let difference = fareDifference(paidCents, paidCents);

        const numbers = cabin
          ? [cabin.totalSeats, cabin.heldSeats, cabin.bookedSeats, cabin.price, cabin.maxWeightKg]
          : [];
        if (!cabin || numbers.some((v) => typeof v !== 'number')) {
          // an old data format (missing seat or baggage fields): cannot be booked yet
          reasons.push(`The ${segment.cabinClass} cabin of this flight is not ready for booking`);
        } else {
          seatsLeft = cabin.totalSeats - cabin.heldSeats - cabin.bookedSeats;
          newFare = segmentFareCents(booking.passengers, toCents(cabin.price));
          difference = fareDifference(paidCents, newFare);

          if (seatsLeft < booking.seatCount) {
            reasons.push(`Not enough seats (${seatsLeft} left, ${booking.seatCount} needed)`);
          }
          const order = segmentOrderProblem(direction, flight, other);
          if (order) reasons.push(order);
          if (direction === SegmentDirection.OUTBOUND) {
            const names = passengersWhoseTypeWouldChange(booking.passengers, localDate);
            if (names.length > 0) {
              reasons.push(
                `${names.join(', ')} would be in a different passenger group (adult/child/infant) on that date`,
              );
            }
          }
          const heavy = passengersOverBagLimit(booking.passengers, cabin.maxWeightKg);
          if (heavy.length > 0) {
            reasons.push(`Extra bags of ${heavy.join(', ')} exceed the weight limit of that flight`);
          }
        }

        return {
          flightId: flight._id.toString(),
          flightNumber: flight.flightNumber,
          originAirport: flight.originAirport,
          destinationAirport: flight.destinationAirport,
          departureTime: flight.departureTime,
          arrivalTime: flight.arrivalTime,
          departureLocalDate: localDate,
          cabinClass: segment.cabinClass,
          farePerSeat: cabin?.price ?? null,
          seatsLeft,
          newFareSubtotal: newFare / 100,
          fareDifference: difference,
          canChange: reasons.length === 0,
          ...(reasons.length > 0 ? { reason: reasons.join('; ') } : {}),
        };
      });

    return { ...base, options };
  }

  // ======================================================================
  // helpers (shared with the change itself in the next steps)
  // ======================================================================

  /**
   * My own Confirmed booking, the flight of it that is changed, and the other flight of a round
   * trip. 404 for someone else's booking; 409 when it is not Confirmed or already departed.
   */
  async loadChangeable(userId: string, id: string, direction: SegmentDirection) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(NOT_FOUND);
    const booking = (await this.bookingModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .lean()
      .exec()) as unknown as BookingLean | null;
    if (!booking) throw new NotFoundException(NOT_FOUND);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('Only a Confirmed booking can be changed');
    }
    const segment: SegmentLean | undefined = booking.segments.find((s) => s.direction === direction);
    if (!segment) throw new BadRequestException(`This booking has no ${direction} flight`);
    if (new Date(segment.departureTime).getTime() <= Date.now()) {
      throw new ConflictException('This flight has already departed and can no longer be changed');
    }
    const other = booking.segments.find((s) => s.direction !== direction) ?? null;
    const currentFlight = (await this.flightModel
      .findById(segment.flightId)
      .select('airlineId')
      .lean()
      .exec()) as unknown as FlightLean | null;
    if (!currentFlight) throw new ConflictException('The current flight is no longer available');
    return { booking, segment, other, currentFlight };
  }

  private async timeZoneOf(iataCode: string): Promise<string | undefined> {
    const airport = await this.airportModel.findOne({ iataCode }).select('timeZone').lean().exec();
    return airport?.timeZone;
  }

  /** 'YYYY-MM-DD' of the departure at the origin airport (older flights may not store it). */
  private localDateOf(flight: FlightLean, timeZone?: string): string {
    if (flight.departureLocalDate) return flight.departureLocalDate;
    const utc = DateTime.fromJSDate(flight.departureTime, { zone: 'utc' });
    const local = timeZone ? utc.setZone(timeZone) : utc;
    return (local.isValid ? local : utc).toISODate() as string;
  }
}

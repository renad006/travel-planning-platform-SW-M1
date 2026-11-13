import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model, Types } from 'mongoose';
import { FlightsService } from '../flights/flights.service';
import { Airline, AirlineDocument } from '../flights/schemas/airline.schema';
import { CabinClass } from '../flights/schemas/cabin-inventory.schema';
import {
  Flight,
  FlightDocument,
  FlightStatus,
} from '../flights/schemas/flight.schema';
import {
  Airport,
  AirportDocument,
} from '../reference-data/schemas/airport.schema';
import {
  CreateFlightBookingDto,
  FlightLegDto,
} from './dto/create-flight-booking.dto';
import {
  ageOnDate,
  baggageFeeCents,
  fareCentsFor,
  fromCents,
  HOLD_MINUTES,
  MAX_PASSENGERS_PER_TYPE,
  passengerTypeForAge,
  PLATFORM_CURRENCY,
  toCents,
} from './flight-bookings.rules';
import {
  AirportMap,
  toPassengerView,
  toPricingView,
  toSegmentView,
} from './flight-bookings.view';
import {
  FlightSegment,
  Passenger,
  PassengerType,
  PolicySnapshot,
  SegmentDirection,
  TripType,
} from './schemas/flight-booking.schema';

// ---- minimal shapes of the lean documents we read from Member 2's collections ----
interface FlightLean {
  _id: Types.ObjectId;
  flightNumber: string;
  airlineId: Types.ObjectId;
  originAirport: string;
  destinationAirport: string;
  departureTime: Date;
  arrivalTime: Date;
  departureLocalDate: string;
  status: FlightStatus;
}
interface AirlineLean {
  _id: Types.ObjectId;
  name: string;
  isActive: boolean;
  baggagePolicy?: { extraBagPrice: number; maxExtraBags: number };
  cancellationPolicy: {
    daysBeforeDeparture: number;
    refundPercentage: number;
  }[];
}
interface CabinLean {
  price: number;
  freeBags: number;
  maxWeightKg: number;
  totalSeats: number;
  heldSeats: number;
  bookedSeats: number;
}
interface Leg {
  direction: SegmentDirection;
  flight: FlightLean;
  airline: AirlineLean;
  cabin: CabinLean;
  cabinClass: CabinClass;
}

/** Everything computed from a request, before anything is saved or reserved. */
interface PreparedBooking {
  tripType: TripType;
  airlineId: Types.ObjectId;
  segments: FlightSegment[];
  passengers: Passenger[];
  seatCount: number;
  currency: string;
  fareTotal: number;
  baggageTotal: number;
  totalPrice: number;
  policiesSnapshot: PolicySnapshot;
  departureTime: Date;
  endsAt: Date;
}

@Injectable()
export class FlightBookingsService {
  constructor(
    @InjectModel(Flight.name)
    private readonly flightModel: Model<FlightDocument>,
    @InjectModel(Airline.name)
    private readonly airlineModel: Model<AirlineDocument>,
    @InjectModel(Airport.name)
    private readonly airportModel: Model<AirportDocument>,
    private readonly flightsService: FlightsService,
  ) {}

  // ======================================================================
  // FLT-19 / FLT-21: validate the request and show the priced summary
  // ======================================================================

  /**
   * Booking summary BEFORE payment (FLT-21). Validates passengers and baggage (FLT-19) and
   * prices everything on the server, but reserves nothing.
   */
  async quote(dto: CreateFlightBookingDto) {
    const prepared = await this.prepare(dto);
    const airports = await this.airportMap(
      this.airportCodes(prepared.segments),
    );
    return {
      tripType: prepared.tripType,
      segments: prepared.segments.map((s) => toSegmentView(s, airports)),
      passengers: prepared.passengers.map((p) => toPassengerView(p, false)),
      seatCount: prepared.seatCount,
      pricing: toPricingView(prepared),
      policies: prepared.policiesSnapshot,
      holdMinutes: HOLD_MINUTES,
      note: 'Nothing is reserved yet. Call POST /flight-bookings/hold to hold the seats and proceed to payment.',
    };
  }

  // ======================================================================
  // Internals
  // ======================================================================

  /** Validates the whole request and computes every price on the server. */
  private async prepare(dto: CreateFlightBookingDto): Promise<PreparedBooking> {
    const out = await this.loadLeg(dto.outbound, SegmentDirection.OUTBOUND);
    const back = dto.return
      ? await this.loadLeg(dto.return, SegmentDirection.RETURN)
      : null;

    if (back) {
      // FLT-12a: the return flight is the swapped route and starts after the outbound lands
      if (
        back.flight.originAirport !== out.flight.destinationAirport ||
        back.flight.destinationAirport !== out.flight.originAirport
      ) {
        throw new BadRequestException(
          'The return flight must fly the outbound route in reverse',
        );
      }
      if (
        back.flight.departureTime.getTime() <= out.flight.arrivalTime.getTime()
      ) {
        throw new BadRequestException(
          'The return flight must depart after the outbound flight arrives',
        );
      }
    }
    const legs = back ? [out, back] : [out];

    const passengers = this.buildPassengers(dto, out, legs);
    const seatCount = passengers.filter(
      (p) => p.type !== PassengerType.INFANT,
    ).length;

    for (const leg of legs) {
      const available =
        leg.cabin.totalSeats - leg.cabin.heldSeats - leg.cabin.bookedSeats;
      if (available < seatCount) {
        throw new ConflictException(
          `Not enough seats available in ${leg.cabinClass} on flight ${leg.flight.flightNumber} ` +
            `(${available} left, ${seatCount} needed)`,
        );
      }
    }

    // ---- snapshots + prices (integer cents) ----
    const segments: FlightSegment[] = legs.map((leg) => {
      const fareCents = toCents(leg.cabin.price);
      const subtotal = passengers.reduce(
        (sum, p) => sum + fareCentsFor(p.type, fareCents),
        0,
      );
      return {
        direction: leg.direction,
        flightId: leg.flight._id,
        flightNumber: leg.flight.flightNumber,
        cabinClass: leg.cabinClass,
        originAirport: leg.flight.originAirport,
        destinationAirport: leg.flight.destinationAirport,
        departureTime: leg.flight.departureTime,
        arrivalTime: leg.flight.arrivalTime,
        farePerSeat: leg.cabin.price,
        fareSubtotal: fromCents(subtotal),
      };
    });

    const fareTotalCents = segments.reduce(
      (sum, s) => sum + toCents(s.fareSubtotal),
      0,
    );
    const baggageTotalCents = passengers.reduce(
      (sum, p) => sum + toCents(p.baggageFee),
      0,
    );

    const baggage = out.airline.baggagePolicy;
    const policiesSnapshot: PolicySnapshot = {
      cancellationTiers: [...out.airline.cancellationPolicy]
        .sort((a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture)
        .map((t) => ({
          daysBeforeDeparture: t.daysBeforeDeparture,
          refundPercentage: t.refundPercentage,
        })),
      extraBagPrice: baggage?.extraBagPrice ?? 0,
      maxExtraBags: baggage?.maxExtraBags ?? 0,
    };

    return {
      tripType: back ? TripType.ROUND_TRIP : TripType.ONE_WAY,
      airlineId: out.flight.airlineId,
      segments,
      passengers,
      seatCount,
      currency: PLATFORM_CURRENCY,
      fareTotal: fromCents(fareTotalCents),
      baggageTotal: fromCents(baggageTotalCents),
      totalPrice: fromCents(fareTotalCents + baggageTotalCents),
      policiesSnapshot,
      departureTime: out.flight.departureTime,
      endsAt: legs[legs.length - 1].flight.arrivalTime,
    };
  }

  private async loadLeg(
    input: FlightLegDto,
    direction: SegmentDirection,
  ): Promise<Leg> {
    const label =
      direction === SegmentDirection.OUTBOUND ? 'outbound' : 'return';
    const flight = (await this.flightModel
      .findById(input.flightId)
      .lean()) as unknown as FlightLean | null;
    if (!flight)
      throw new NotFoundException(`The ${label} flight was not found`);
    if (
      flight.status !== FlightStatus.SCHEDULED ||
      flight.departureTime.getTime() <= Date.now()
    ) {
      throw new ConflictException(
        `The ${label} flight (${flight.flightNumber}) is not available for booking`,
      );
    }
    const airline = (await this.airlineModel
      .findById(flight.airlineId)
      .lean()) as unknown as AirlineLean | null;
    if (!airline || !airline.isActive) {
      throw new ConflictException(
        `The airline of the ${label} flight is not available for booking`,
      );
    }
    // Airlines created by an older version of the flights module may lack policies or store them
    // in an old shape. Keep only valid ones, so a missing policy means "no extra bags / 0% refund".
    const bag = airline.baggagePolicy;
    airline.baggagePolicy =
      typeof bag?.extraBagPrice === 'number' &&
      typeof bag?.maxExtraBags === 'number'
        ? bag
        : undefined;
    airline.cancellationPolicy = (airline.cancellationPolicy ?? []).filter(
      (t) =>
        typeof t.daysBeforeDeparture === 'number' &&
        typeof t.refundPercentage === 'number',
    );
    // 404 when the flight has no such cabin
    const cabin = (await this.flightsService.getCabin(
      input.flightId,
      input.cabinClass,
    )) as unknown as CabinLean;
    // A cabin created by an older version has no seat counters or baggage fields. Seats cannot be
    // reserved on it (the atomic seat update needs the counters), so say so clearly (no 500).
    const cabinNumbers = [
      cabin.totalSeats,
      cabin.heldSeats,
      cabin.bookedSeats,
      cabin.freeBags,
      cabin.maxWeightKg,
    ];
    if (cabinNumbers.some((v) => typeof v !== 'number')) {
      throw new ConflictException(
        `The ${label} flight (${flight.flightNumber}) was created with an older data format ` +
          `(missing seat or baggage fields) and cannot be booked yet. Ask the airline to re-create it.`,
      );
    }
    flight.departureLocalDate = await this.localDateOf(flight);
    return { direction, flight, airline, cabin, cabinClass: input.cabinClass };
  }

  /**
   * 'YYYY-MM-DD' of the departure at the ORIGIN airport. Flights created by an older version of
   * the flights module do not store it, so it is derived from the UTC departure time and the
   * airport's time zone.
   */
  private async localDateOf(flight: FlightLean): Promise<string> {
    if (flight.departureLocalDate) return flight.departureLocalDate;
    const airport = await this.airportModel
      .findOne({ iataCode: flight.originAirport })
      .select('timeZone')
      .lean();
    const utc = DateTime.fromJSDate(flight.departureTime, { zone: 'utc' });
    const local = airport?.timeZone ? utc.setZone(airport.timeZone) : utc;
    return (local.isValid ? local : utc).toISODate() as string;
  }

  /**
   * FLT-19 + FLT-12b + FLT-08: passenger rules.
   * - the declared type must match the date of birth on the OUTBOUND departure date
   * - at least one adult, no more infants than adults
   * - extra bags within the airline maximum, weight within bags x the cabin's max weight per bag
   * Baggage rules and price come from the outbound airline/cabin (the booking is one policy unit).
   */
  private buildPassengers(
    dto: CreateFlightBookingDto,
    out: Leg,
    legs: Leg[],
  ): Passenger[] {
    const refDate = out.flight.departureLocalDate;
    const today = DateTime.utc().startOf('day');
    const passports = new Set<string>();
    const baggagePolicy = out.airline.baggagePolicy;

    const passengers = dto.passengers.map((input, index): Passenger => {
      const who = `Passenger ${index + 1} (${input.fullName})`;

      const parsed = DateTime.fromISO(input.dateOfBirth, { zone: 'utc' });
      if (!parsed.isValid)
        throw new BadRequestException(
          `${who}: dateOfBirth is not a valid date`,
        );
      if (parsed > today)
        throw new BadRequestException(
          `${who}: date of birth cannot be in the future`,
        );
      const age = ageOnDate(parsed.toJSDate(), refDate);
      if (age < 0)
        throw new BadRequestException(
          `${who}: was not yet born on the departure date`,
        );
      if (age > 120)
        throw new BadRequestException(`${who}: date of birth is not realistic`);
      const expectedType = passengerTypeForAge(age);
      if (expectedType !== input.type) {
        throw new BadRequestException(
          `${who}: aged ${age} on the departure date, so this passenger must be booked as ` +
            `"${expectedType}", not "${input.type}"`,
        );
      }

      if (passports.has(input.passportNumber)) {
        throw new BadRequestException(
          `${who}: passport ${input.passportNumber} is used twice in this booking`,
        );
      }
      passports.add(input.passportNumber);

      // ---- extra baggage (FLT-19 / FLT-08) ----
      const extraBags = input.extraBags ?? 0;
      const extraBagWeightKg = input.extraBagWeightKg ?? 0;
      if (extraBags === 0 && extraBagWeightKg > 0) {
        throw new BadRequestException(
          `${who}: extraBagWeightKg is set but extraBags is 0`,
        );
      }
      if (extraBags > 0) {
        if (!baggagePolicy) {
          throw new BadRequestException(
            `${who}: this airline does not sell extra baggage`,
          );
        }
        if (extraBags > baggagePolicy.maxExtraBags) {
          throw new BadRequestException(
            `${who}: at most ${baggagePolicy.maxExtraBags} extra bag(s) are allowed per passenger`,
          );
        }
        if (extraBagWeightKg <= 0) {
          throw new BadRequestException(
            `${who}: extraBagWeightKg is required when adding extra bags`,
          );
        }
        const maxWeight = extraBags * out.cabin.maxWeightKg;
        if (extraBagWeightKg > maxWeight) {
          throw new BadRequestException(
            `${who}: extra bags may weigh at most ${maxWeight} kg in total ` +
              `(${out.cabin.maxWeightKg} kg per bag in ${out.cabinClass})`,
          );
        }
      }

      // each passenger's share of the fare across all segments
      const fareCents = legs.reduce(
        (sum, leg) => sum + fareCentsFor(input.type, toCents(leg.cabin.price)),
        0,
      );
      return {
        type: input.type,
        fullName: input.fullName,
        dateOfBirth: parsed.toJSDate(),
        passportNumber: input.passportNumber,
        extraBags,
        extraBagWeightKg,
        fare: fromCents(fareCents),
        baggageFee: fromCents(
          baggageFeeCents(extraBags, baggagePolicy?.extraBagPrice ?? 0),
        ),
      };
    });

    const adults = passengers.filter(
      (p) => p.type === PassengerType.ADULT,
    ).length;
    const children = passengers.filter(
      (p) => p.type === PassengerType.CHILD,
    ).length;
    const infants = passengers.filter(
      (p) => p.type === PassengerType.INFANT,
    ).length;
    if (adults < 1)
      throw new BadRequestException(
        'Each booking needs at least one adult (12+)',
      );
    if (infants > adults)
      throw new BadRequestException(
        'Each infant needs an adult: infants cannot exceed adults',
      );
    for (const [label, count] of [
      ['adults', adults],
      ['children', children],
      ['infants', infants],
    ] as const) {
      if (count > MAX_PASSENGERS_PER_TYPE) {
        throw new BadRequestException(
          `A booking can have at most ${MAX_PASSENGERS_PER_TYPE} ${label}`,
        );
      }
    }
    return passengers;
  }

  private airportCodes(segments: FlightSegment[]): string[] {
    return segments.flatMap((s) => [s.originAirport, s.destinationAirport]);
  }

  private async airportMap(codes: string[]): Promise<AirportMap> {
    const unique = [...new Set(codes)];
    const rows = await this.airportModel
      .find({ iataCode: { $in: unique } })
      .lean();
    return new Map(
      rows.map((a) => [
        a.iataCode,
        { iataCode: a.iataCode, name: a.name, timeZone: a.timeZone },
      ]),
    );
  }
}

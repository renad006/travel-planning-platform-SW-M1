import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { randomInt } from 'crypto';
import { DateTime } from 'luxon';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { FlightsService } from '../flights/flights.service';
import { Airline, AirlineDocument } from '../flights/schemas/airline.schema';
import { CabinClass } from '../flights/schemas/cabin-inventory.schema';
import {
  Flight,
  FlightDocument,
  FlightStatus,
} from '../flights/schemas/flight.schema';
import {
  NotificationsService,
  NotifyInput,
} from '../notifications/notifications.service';
import {
  Airport,
  AirportDocument,
} from '../reference-data/schemas/airport.schema';
import { BookingType } from '../payments/enums/payment.enums';
import type {
  PayableBooking,
  PayableBookingService,
} from '../payments/payable-booking.interface';
import {
  CreateFlightBookingDto,
  FlightLegDto,
} from './dto/create-flight-booking.dto';
import {
  BookingGroup,
  ListFlightBookingsDto,
} from './dto/list-flight-bookings.dto';
import {
  FLIGHT_BOOKING_EVENTS,
  FlightBookingExpiredEvent,
} from './flight-bookings.events';
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
  BookingRecord,
  BookingView,
  toBookingView,
  toPassengerView,
  toPricingView,
  toSegmentView,
} from './flight-bookings.view';
import {
  FlightBooking,
  FlightBookingDocument,
  FlightSegment,
  Passenger,
  PassengerType,
  PolicySnapshot,
  SegmentDirection,
  TripType,
} from './schemas/flight-booking.schema';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const NOT_FOUND = 'Flight booking not found';
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I: easy to read aloud
const MAX_ID_RETRIES = 5;

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
export class FlightBookingsService implements PayableBookingService {
  private readonly logger = new Logger(FlightBookingsService.name);

  constructor(
    @InjectModel(FlightBooking.name)
    private readonly bookingModel: Model<FlightBookingDocument>,
    @InjectModel(Flight.name)
    private readonly flightModel: Model<FlightDocument>,
    @InjectModel(Airline.name)
    private readonly airlineModel: Model<AirlineDocument>,
    @InjectModel(Airport.name)
    private readonly airportModel: Model<AirportDocument>,
    private readonly flightsService: FlightsService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
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
  // FLT-22: concurrency-safe seat hold
  // ======================================================================

  /**
   * "Proceed to payment": reserve the seats atomically and create a Pending Payment booking
   * held for 10 minutes.
   *
   * Seat safety comes from FlightsService.reserveSeats, a SINGLE conditional update
   * (`free seats >= requested` checked and incremented in one atomic step), so two parallel
   * requests can never take the same last seat. For a round trip both legs are reserved; if
   * the second fails, the first is released again, so it is all-or-nothing.
   */
  async hold(userId: string, dto: CreateFlightBookingDto) {
    const prepared = await this.prepare(dto);

    const reserved: FlightSegment[] = [];
    let created: FlightBookingDocument;
    try {
      for (const segment of prepared.segments) {
        await this.flightsService.reserveSeats(
          segment.flightId.toString(),
          segment.cabinClass,
          prepared.seatCount,
        );
        reserved.push(segment);
      }
      created = await this.bookingModel.create({
        userId: new Types.ObjectId(userId),
        airlineId: prepared.airlineId,
        tripType: prepared.tripType,
        segments: prepared.segments,
        passengers: prepared.passengers,
        seatCount: prepared.seatCount,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
        currency: prepared.currency,
        fareTotal: prepared.fareTotal,
        baggageTotal: prepared.baggageTotal,
        totalPrice: prepared.totalPrice,
        policiesSnapshot: prepared.policiesSnapshot,
        departureTime: prepared.departureTime,
        endsAt: prepared.endsAt,
      });
    } catch (error) {
      // all-or-nothing: give back whatever was already held
      for (const segment of reserved) {
        await this.releaseHeldSegment(
          segment,
          prepared.seatCount,
          'rollback of a failed hold',
        );
      }
      throw error;
    }

    const [view] = await this.toViews(
      [created.toObject() as unknown as BookingRecord],
      false,
    );
    return view;
  }

  // ======================================================================
  // FLT-25: my bookings
  // ======================================================================

  async list(
    userId: string,
    query: ListFlightBookingsDto,
  ): Promise<PaginatedResponse<BookingView>> {
    const now = new Date();
    const filter = {
      userId: new Types.ObjectId(userId),
      ...this.groupFilter(query.group, now),
    };
    const sort: Record<string, 1 | -1> =
      query.group === BookingGroup.UPCOMING
        ? { departureTime: 1, _id: 1 }
        : query.group
          ? { departureTime: -1, _id: -1 }
          : { createdAt: -1, _id: -1 };

    const [rows, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.bookingModel.countDocuments(filter),
    ]);
    const items = await this.toViews(rows as unknown as BookingRecord[], true);
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(userId: string, id: string): Promise<BookingView> {
    const booking = await this.findOwned(userId, id);
    const [view] = await this.toViews([booking], false);
    return view;
  }

  // ======================================================================
  // Booking contract for Payments (Member 5): payments/payable-booking.interface.ts
  // Payments never reads or writes this collection directly; it only calls these methods.
  // ======================================================================

  /** What Payments needs to know about a booking. No ownership check here: Payments does it. */
  async findPayable(id: string): Promise<PayableBooking> {
    const booking = (await this.bookingModel
      .findById(this.toObjectId(id))
      .lean()) as unknown as BookingRecord | null;
    if (!booking) throw new NotFoundException(NOT_FOUND);

    const snapshot = booking.policiesSnapshot;
    const cancellationTiers = (snapshot?.cancellationTiers ?? []).map((t) => ({
      daysBeforeDeparture: t.daysBeforeDeparture,
      refundPercentage: t.refundPercentage,
    }));
    return {
      id: booking._id.toString(),
      type: BookingType.FLIGHT,
      ownerId: booking.userId.toString(),
      providerId: booking.airlineId.toString(),
      amount: booking.totalPrice,
      currency: booking.currency,
      status: booking.status,
      // only meaningful while the booking waits for payment
      holdExpiresAt:
        booking.status === BookingStatus.PENDING_PAYMENT
          ? (booking.holdExpiresAt ?? null)
          : null,
      policiesAcceptedAt: booking.policiesAcceptedAt ?? null,
      // FLT-12a: a round trip is refunded by the OUTBOUND departure
      cancellationAnchor: booking.departureTime,
      cancellationTiers,
      policySnapshot: {
        cancellationTiers,
        extraBagPrice: snapshot?.extraBagPrice ?? 0,
        maxExtraBags: snapshot?.maxExtraBags ?? 0,
      },
    };
  }

  /**
   * FLT-23 / PAY-01: called by the Stripe webhook after payment_intent.succeeded.
   * ATOMIC: only a booking still in PENDING_PAYMENT with a live hold becomes CONFIRMED.
   * Held seats become booked seats, a unique reference and e-ticket number are generated and the
   * user is notified.
   *
   * Returns true when this payment confirmed the booking (a webhook redelivery of the SAME payment
   * is also true). Returns false when the booking was no longer pending (expired, cancelled, a
   * different payment already confirmed it, or it does not exist): Payments then refunds 100%.
   * `paymentId` is the id of Payments' Payment document.
   */
  async confirmAfterPayment(id: string, paymentId: string): Promise<boolean> {
    if (!OBJECT_ID.test(paymentId)) {
      throw new BadRequestException(
        'paymentId must be the id of the Payment document',
      );
    }
    const bookingId = this.toObjectId(id);
    const existing = (await this.bookingModel
      .findById(bookingId)
      .lean()) as unknown as BookingRecord | null;
    if (!existing) {
      this.logger.warn(
        `Payment ${paymentId} succeeded for unknown flight booking ${id}`,
      );
      return false;
    }
    if (existing.status === BookingStatus.CONFIRMED) {
      return existing.paymentId?.toString() === paymentId; // redelivery vs a second payment
    }
    if (existing.status !== BookingStatus.PENDING_PAYMENT) return false;
    if (
      existing.holdExpiresAt &&
      existing.holdExpiresAt.getTime() <= Date.now()
    ) {
      await this.expireIfPending(bookingId); // the cron has not run yet: expire it now
      return false;
    }

    // The unique indexes make a generated reference collide only with astronomically small
    // probability; if it ever does we simply retry.
    let claimed: FlightBookingDocument | null = null;
    for (let attempt = 0; attempt < MAX_ID_RETRIES && !claimed; attempt += 1) {
      try {
        claimed = await this.bookingModel.findOneAndUpdate(
          {
            _id: bookingId,
            status: BookingStatus.PENDING_PAYMENT,
            holdExpiresAt: { $gt: new Date() },
          },
          {
            $set: {
              status: BookingStatus.CONFIRMED,
              confirmedAt: new Date(),
              paymentId: new Types.ObjectId(paymentId),
              reference: this.generateReference(),
              eTicketNumber: this.generateETicketNumber(),
            },
          },
          { returnDocument: 'after' },
        );
        if (!claimed) break; // lost a race (expired / confirmed by a parallel call)
      } catch (error) {
        if (!this.isDuplicateKey(error)) throw error;
      }
    }
    if (!claimed) {
      const current = (await this.bookingModel
        .findById(bookingId)
        .lean()) as unknown as BookingRecord | null;
      return (
        current?.status === BookingStatus.CONFIRMED &&
        current.paymentId?.toString() === paymentId
      );
    }

    const record = claimed.toObject() as unknown as BookingRecord;
    for (const segment of record.segments) {
      try {
        await this.flightsService.confirmSeats(
          segment.flightId.toString(),
          segment.cabinClass,
          record.seatCount,
        );
      } catch (error) {
        // Should be impossible (Member 2 never lets seats drop below held+booked).
        this.logger.error(
          `CRITICAL: booking ${record._id.toString()} is Confirmed but seats of flight ` +
            `${segment.flightNumber} could not be moved from held to booked: ${(error as Error).message}`,
        );
        throw new InternalServerErrorException(
          'The booking was confirmed but seat inventory needs attention',
        );
      }
    }

    await this.safeNotify({
      userId: record.userId.toString(),
      type: 'FLIGHT_BOOKING_CONFIRMED',
      title: 'Flight booking confirmed',
      message:
        `Your booking ${record.reference} is confirmed: ${this.routeLabel(record)}, ` +
        `${record.passengers.length} passenger(s), total ${record.totalPrice.toFixed(2)} ${record.currency}. ` +
        `Your e-ticket number is ${record.eTicketNumber}.`,
      related: { type: 'flight_booking', id: record._id.toString() },
    });
    return true;
  }

  /** FLT-22: Pending Payment -> Expired and the seats are released (no-op if no longer pending). */
  async expireHold(id: string): Promise<void> {
    await this.expireIfPending(this.toObjectId(id));
  }

  /** PAY-02: Payments saved the acceptance record, this stores the timestamp on the booking. */
  async markPoliciesAccepted(id: string, acceptedAt: Date): Promise<void> {
    const result = await this.bookingModel.updateOne(
      { _id: this.toObjectId(id) },
      { $set: { policiesAcceptedAt: acceptedAt } },
    );
    if (result.matchedCount === 0) throw new NotFoundException(NOT_FOUND);
  }

  /** ACC-12 (Member 1): a user with upcoming Confirmed bookings cannot deactivate the account. */
  async hasUpcomingConfirmedBookings(userId: string): Promise<boolean> {
    const count = await this.bookingModel.countDocuments({
      userId: new Types.ObjectId(userId),
      status: BookingStatus.CONFIRMED,
      endsAt: { $gte: new Date() },
    });
    return count > 0;
  }

  // ======================================================================
  // FLT-22 / GEN-11: scheduled lifecycle jobs (called by FlightBookingsTasks)
  // ======================================================================

  /** Pending Payment -> Expired for every hold older than 10 minutes; releases the seats. */
  async expireDueHolds(batchSize = 200): Promise<number> {
    const due = await this.bookingModel
      .find({
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { $lte: new Date() },
      })
      .select('_id')
      .limit(batchSize)
      .lean();
    let expired = 0;
    for (const row of due) {
      if (await this.expireIfPending(row._id)) expired += 1;
    }
    return expired;
  }

  /** Confirmed -> Completed once the whole trip is over (GEN-11). */
  async completeFinishedBookings(): Promise<number> {
    const result = await this.bookingModel.updateMany(
      { status: BookingStatus.CONFIRMED, endsAt: { $lt: new Date() } },
      { $set: { status: BookingStatus.COMPLETED } },
    );
    return result.modifiedCount;
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

  /** FLT-25 groups. Bookings whose hold already ran out count as cancelled/expired. */
  private groupFilter(
    group: BookingGroup | undefined,
    now: Date,
  ): Record<string, unknown> {
    switch (group) {
      case BookingGroup.UPCOMING:
        return {
          $or: [
            { status: BookingStatus.CONFIRMED, endsAt: { $gte: now } },
            {
              status: BookingStatus.PENDING_PAYMENT,
              holdExpiresAt: { $gt: now },
            },
          ],
        };
      case BookingGroup.PAST:
        return {
          $or: [
            { status: BookingStatus.COMPLETED },
            { status: BookingStatus.CONFIRMED, endsAt: { $lt: now } },
          ],
        };
      case BookingGroup.CANCELLED:
        return {
          $or: [
            {
              status: { $in: [BookingStatus.CANCELLED, BookingStatus.EXPIRED] },
            },
            {
              status: BookingStatus.PENDING_PAYMENT,
              holdExpiresAt: { $lte: now },
            },
          ],
        };
      default:
        return {};
    }
  }

  /** ACC-11: only the owner can see a booking; anyone else gets 404 (does not leak existence). */
  private async findOwned(userId: string, id: string): Promise<BookingRecord> {
    const _id = this.toObjectId(id);
    let booking = (await this.bookingModel
      .findOne({ _id, userId: new Types.ObjectId(userId) })
      .lean()) as unknown as BookingRecord | null;
    if (!booking) throw new NotFoundException(NOT_FOUND);

    // lazy expiry, so the user never sees a stale "pending" booking before the cron ran
    if (
      booking.status === BookingStatus.PENDING_PAYMENT &&
      booking.holdExpiresAt &&
      booking.holdExpiresAt.getTime() <= Date.now()
    ) {
      await this.expireIfPending(_id);
      booking = (await this.bookingModel
        .findById(_id)
        .lean()) as unknown as BookingRecord;
    }
    return booking;
  }

  /**
   * Pending Payment -> Expired. One atomic claim, so the cron, a lazy read, a flight cancellation
   * and Payments can race safely: only the winner releases the seats (exactly once).
   * Callers decide WHEN a hold is due; this only checks that the booking is still pending.
   */
  private async expireIfPending(id: Types.ObjectId): Promise<boolean> {
    const now = new Date();
    const claimed = await this.bookingModel.findOneAndUpdate(
      { _id: id, status: BookingStatus.PENDING_PAYMENT },
      { $set: { status: BookingStatus.EXPIRED, expiredAt: now } },
      { returnDocument: 'after' },
    );
    if (!claimed) return false;

    const record = claimed.toObject() as unknown as BookingRecord;
    for (const segment of record.segments) {
      await this.releaseHeldSegment(
        segment,
        record.seatCount,
        `expiry of booking ${record._id.toString()}`,
      );
    }
    // TODO(Member 5): once PaymentsService.cancelIntentForBooking('flight', id) exists, the open
    // Stripe PaymentIntent must be cancelled here. The event below carries everything Payments
    // needs, so Payments can simply listen to it (no circular module dependency); otherwise call
    // it directly from this method.
    const expired: FlightBookingExpiredEvent = {
      bookingId: record._id.toString(),
      userId: record.userId.toString(),
      paymentId: record.paymentId?.toString(),
    };
    this.events.emit(FLIGHT_BOOKING_EVENTS.EXPIRED, expired);
    return true;
  }

  private async releaseHeldSegment(
    segment: FlightSegment,
    seats: number,
    context: string,
  ) {
    try {
      await this.flightsService.releaseHeldSeats(
        segment.flightId.toString(),
        segment.cabinClass,
        seats,
      );
    } catch (error) {
      this.logger.error(
        `Could not release ${seats} held seat(s) of flight ${segment.flightNumber} (${context}): ` +
          (error as Error).message,
      );
    }
  }

  // ---- small helpers -----------------------------------------------------

  private async toViews(
    records: BookingRecord[],
    maskPassports: boolean,
  ): Promise<BookingView[]> {
    const airports = await this.airportMap(
      records.flatMap((r) => this.airportCodes(r.segments)),
    );
    return records.map((r) => toBookingView(r, airports, { maskPassports }));
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

  private routeLabel(booking: Pick<BookingRecord, 'segments'>): string {
    const first = booking.segments[0];
    const route = `${first.originAirport} to ${first.destinationAirport}`;
    return booking.segments.length > 1 ? `${route} and back` : route;
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!OBJECT_ID.test(id)) throw new NotFoundException(NOT_FOUND);
    return new Types.ObjectId(id);
  }

  /** FB-XXXXXXXX: 8 unambiguous characters from a cryptographically secure generator. */
  private generateReference(): string {
    let code = '';
    for (let i = 0; i < 8; i += 1)
      code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
    return `FB-${code}`;
  }

  /** ETK + 13 digits, the shape of a real e-ticket number. */
  private generateETicketNumber(): string {
    let digits = '';
    for (let i = 0; i < 13; i += 1) digits += randomInt(10).toString();
    return `ETK${digits}`;
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === 11000
    );
  }

  /** A failed notification must never break a booking, a cancellation or a webhook. */
  private async safeNotify(input: NotifyInput): Promise<void> {
    try {
      await this.notifications.notify(input);
    } catch (error) {
      this.logger.error(
        `Notification "${input.type}" failed: ${(error as Error).message}`,
      );
    }
  }
}

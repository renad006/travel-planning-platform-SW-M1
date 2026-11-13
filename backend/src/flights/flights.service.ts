import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fsp } from 'fs';
import { DateTime } from 'luxon';
import { Model, Types } from 'mongoose';
import { join } from 'path';
import { Role } from '../common/enums/role.enum';
import { Airport, AirportDocument } from '../reference-data/schemas/airport.schema';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { CreateCabinDto } from './dto/create-cabin.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { ListAirlinesDto } from './dto/list-airlines.dto';
import { ListAirportsDto } from './dto/list-airports.dto';
import { PaginationDto } from './dto/pagination.dto';
import { FlightSortBy, SearchFlightsDto, SortOrder } from './dto/search-flights.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { BaggagePolicyDto, CancellationPolicyDto } from './dto/update-policies.dto';
import { FlightBookingsReader } from './flight-bookings.reader';
import {
  FLIGHT_EVENTS,
  FlightCancelledEvent,
  FlightDepartedEvent,
  FlightScheduleChangedEvent,
} from './flight.events';
import { Airline, AirlineDocument, CancellationTier } from './schemas/airline.schema';
import {
  CabinClass,
  CabinInventory,
  CabinInventoryDocument,
} from './schemas/cabin-inventory.schema';
import { Flight, FlightDocument, FlightStatus } from './schemas/flight.schema';

/** What @CurrentUser() returns (see Member 1's auth setup). */
export type AuthUser = {
  _id: Types.ObjectId | string;
  role: Role;
  assignedProviderId?: Types.ObjectId | string | null;
};

const OBJECT_ID = /^[a-f\d]{24}$/i;
const DAY_MS = 86_400_000;

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    @InjectModel(Airline.name) private readonly airlineModel: Model<AirlineDocument>,
    @InjectModel(Flight.name) private readonly flightModel: Model<FlightDocument>,
    @InjectModel(CabinInventory.name) private readonly cabinModel: Model<CabinInventoryDocument>,
    @InjectModel(Airport.name) private readonly airportModel: Model<AirportDocument>,
    private readonly bookingsReader: FlightBookingsReader,
    private readonly events: EventEmitter2,
  ) {}

  // ================================================================
  // Helpers
  // ================================================================

  private oid(id: string, label = 'id'): Types.ObjectId {
    if (!OBJECT_ID.test(id)) throw new BadRequestException(`Invalid ${label}`);
    return new Types.ObjectId(id);
  }

  /** Turns a Mongo duplicate-key error into a 409; anything else is rethrown as is. */
  private mapDuplicate(e: any, message: string): Error {
    return e?.code === 11000 ? new ConflictException(message) : e;
  }

  /** Saves a document; Mongoose validation errors become 400, duplicate keys 409. */
  private async saveDoc<T>(doc: { save(): Promise<T> }, duplicateMessage: string): Promise<T> {
    try {
      return await doc.save();
    } catch (e: any) {
      if (e?.name === 'ValidationError') {
        throw new BadRequestException(
          Object.values(e.errors ?? {})
            .map((err: any) => err.message)
            .join(', ') || 'Validation failed',
        );
      }
      throw this.mapDuplicate(e, duplicateMessage);
    }
  }

  /** Airline moderators may only touch their assigned airline (moderator assignment). */
  private assertOwnsAirline(user: AuthUser, airlineId: Types.ObjectId | string, allowAdmin = false) {
    if (allowAdmin && user.role === Role.ADMIN) return;
    if (
      user.role !== Role.AIRLINE_MODERATOR ||
      !user.assignedProviderId ||
      user.assignedProviderId.toString() !== airlineId.toString()
    ) {
      throw new ForbiddenException('You can only manage your assigned airline');
    }
  }

  private async loadManagedAirline(id: string, user: AuthUser, allowAdmin = false) {
    const airline = await this.airlineModel.findById(this.oid(id, 'airline id'));
    if (!airline) throw new NotFoundException('Airline not found');
    this.assertOwnsAirline(user, airline._id, allowAdmin);
    return airline;
  }

  private async loadOwnedFlight(flightId: string, user: AuthUser, mustBeScheduled = false) {
    const flight = await this.flightModel.findById(this.oid(flightId, 'flight id'));
    if (!flight) throw new NotFoundException('Flight not found');
    this.assertOwnsAirline(user, flight.airlineId, true);
    if (
      mustBeScheduled &&
      (flight.status !== FlightStatus.SCHEDULED || flight.departureTime.getTime() <= Date.now())
    ) {
      throw new ConflictException('Only Scheduled flights can be modified');
    }
    return flight;
  }

  private async findAirportMap(codes: string[]) {
    const docs = await this.airportModel.find({ iataCode: { $in: codes } });
    return new Map(docs.map((a) => [a.iataCode, a] as const));
  }

  /** FLT-02: only airports from the reference list are accepted. */
  private async getAirports(codes: string[]) {
    const map = await this.findAirportMap(codes);
    const unknown = codes.filter((c) => !map.has(c));
    if (unknown.length) {
      throw new BadRequestException(
        `Unknown airport code(s): ${unknown.join(', ')}. Use GET /api/airports.`,
      );
    }
    return map;
  }

  /** FLT-03 / GEN-06: read a local date-time (no offset) in the airport's IANA zone. */
  private parseLocal(value: string, zone: string, label: string): DateTime {
    const dt = DateTime.fromISO(value, { zone });
    if (!dt.isValid) throw new BadRequestException(`${label} is not a valid date-time in ${zone}`);
    return dt;
  }

  private assertValidSchedule(departure: Date, arrival: Date) {
    if (arrival.getTime() <= departure.getTime()) {
      throw new BadRequestException('Arrival must be after departure (compared in UTC)');
    }
    if (departure.getTime() <= Date.now()) {
      throw new BadRequestException('Departure cannot be in the past');
    }
  }

  private localDate(date: Date, zone: string): string {
    return DateTime.fromJSDate(date, { zone }).toISODate() as string;
  }

  /** GEN-06: every flight time is exposed as UTC + local ISO (with offset) + zone name. */
  private timeView(date: Date, zone: string) {
    return {
      utc: date.toISOString(),
      local: DateTime.fromJSDate(date, { zone }).toISO(),
      timeZone: zone,
    };
  }

  private airportView(code: string, a?: AirportDocument) {
    return { iataCode: code, name: a?.name ?? null, timeZone: a?.timeZone ?? 'UTC' };
  }

  private flightView(flight: any, origin?: AirportDocument, destination?: AirportDocument) {
    const o = this.airportView(flight.originAirport, origin);
    const d = this.airportView(flight.destinationAirport, destination);
    return {
      ...flight,
      origin: o,
      destination: d,
      departure: this.timeView(flight.departureTime, o.timeZone),
      arrival: this.timeView(flight.arrivalTime, d.timeZone),
      durationMinutes: Math.round((flight.arrivalTime.getTime() - flight.departureTime.getTime()) / 60000),
    };
  }

  private async emitSafe(event: string, payload: object) {
    try {
      const results = await this.events.emitAsync(event, payload);
      if (!results.length) {
        // nobody listens yet (bookings / notifications module not merged) - make it visible
        this.logger.warn(`No listener registered for "${event}"`);
      }
    } catch (e: any) {
      this.logger.error(`Listener for "${event}" failed: ${e?.message ?? e}`);
    }
  }

  private static escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ================================================================
  // FLT-02  Airports (read-only reference data)
  // ================================================================

  async listAirports(dto: ListAirportsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const match: Record<string, any> = {};
    if (dto.countryCode) match.countryCode = dto.countryCode;
    if (dto.cityId) match.cityId = dto.cityId; // cityId is a plain string from Cities.csv
    if (dto.search) {
      const rx = new RegExp(FlightsService.escapeRegex(dto.search), 'i');
      match.$or = [{ iataCode: rx }, { name: rx }];
    }

    const [res] = await this.airportModel.aggregate([
      { $match: match },
      { $sort: { iataCode: 1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { iataCode: 1, name: 1, cityId: 1, countryCode: 1, timeZone: 1 } },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    const total = res.total[0]?.count ?? 0;
    return { data: res.data, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  // ================================================================
  // FLT-01  Airlines
  // ================================================================

  async createAirline(dto: CreateAirlineDto) {
    try {
      return await this.airlineModel.create({ name: dto.name, iataCode: dto.iataCode });
    } catch (e) {
      throw this.mapDuplicate(e, 'An airline with this name or code already exists');
    }
  }

  /** Extra endpoint: active airlines only (search filter, admin moderator form). */
  async listAirlines(dto: ListAirlinesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const match: Record<string, any> = { isActive: true };
    if (dto.search) {
      const rx = new RegExp(FlightsService.escapeRegex(dto.search), 'i');
      match.$or = [{ name: rx }, { iataCode: rx }];
    }
    const [res] = await this.airlineModel.aggregate([
      { $match: match },
      { $sort: { name: 1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { name: 1, iataCode: 1, logoUrl: 1, isActive: 1 } },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    const total = res.total[0]?.count ?? 0;
    return { data: res.data, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async getAirline(id: string) {
    const airline = await this.airlineModel.findById(this.oid(id, 'airline id')).lean();
    if (!airline) throw new NotFoundException('Airline not found');
    return airline;
  }

  /** FLT-01: admin, or the moderator of this airline, edits name / code. */
  async updateAirline(id: string, dto: UpdateAirlineDto, user: AuthUser) {
    if (dto.name === undefined && dto.iataCode === undefined) {
      throw new BadRequestException('Send name and/or iataCode');
    }
    const airline = await this.loadManagedAirline(id, user, true);
    if (dto.name !== undefined) airline.name = dto.name;
    if (dto.iataCode !== undefined) airline.iataCode = dto.iataCode;
    return this.saveDoc(airline, 'An airline with this name or code already exists');
  }

  /** GEN-08: the MIME type can be faked, so check the file's first bytes (PNG / JPEG signature). */
  private async assertImageFile(path: string) {
    const fh = await fsp.open(path, 'r');
    try {
      const { buffer, bytesRead } = await fh.read(Buffer.alloc(8), 0, 8, 0);
      const png =
        bytesRead >= 8 &&
        buffer.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const jpg = bytesRead >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      if (!png && !jpg) throw new BadRequestException('The file is not a valid JPG or PNG image');
    } finally {
      await fh.close();
    }
  }

  /** FLT-01 + GEN-08: one logo per airline; the new file replaces the old one. */
  async setLogo(id: string, file: Express.Multer.File | undefined, user: AuthUser) {
    if (!file) throw new BadRequestException('A JPG or PNG file is required (form field "file")');
    try {
      const airline = await this.loadManagedAirline(id, user, true);
      await this.assertImageFile(file.path);
      const previous = airline.logoUrl;
      airline.logoUrl = `/uploads/airlines/${file.filename}`;
      await this.saveDoc(airline, 'Could not save the logo');
      if (previous) fsp.unlink(join(process.cwd(), previous)).catch(() => undefined);
      return airline;
    } catch (e) {
      // the file is already on disk (multer runs first) - don't leave an orphan behind
      await fsp.unlink(file.path).catch(() => undefined);
      throw e;
    }
  }

  // ---- FLT-08: extra baggage rules ----
  async updateBaggagePolicy(id: string, dto: BaggagePolicyDto, user: AuthUser) {
    const airline = await this.loadManagedAirline(id, user);
    airline.baggagePolicy = { extraBagPrice: dto.extraBagPrice, maxExtraBags: dto.maxExtraBags };
    return this.saveDoc(airline, 'Could not save the baggage policy');
  }

  // ---- FLT-09: cancellation tiers ----
  async updateCancellationPolicy(id: string, dto: CancellationPolicyDto, user: AuthUser) {
    const airline = await this.loadManagedAirline(id, user);
    airline.cancellationPolicy = [...dto.rules]
      .sort((a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture)
      .map((r) => ({ daysBeforeDeparture: r.daysBeforeDeparture, refundPercentage: r.refundPercentage }));
    return this.saveDoc(airline, 'Could not save the cancellation policy');
  }

  /** FLT-09 rule: highest threshold not exceeding the days remaining; no tier => 0%. */
  private static pickRefundPercentage(tiers: CancellationTier[], daysRemaining: number): number {
    const tier = [...tiers]
      .filter((t) => t.daysBeforeDeparture <= daysRemaining)
      .sort((a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture)[0];
    return tier?.refundPercentage ?? 0;
  }

  /**
   * Used by Member 3 / Member 5 for FLT-26 and PAY-03.
   * daysRemaining = whole 24h periods between `at` and departure.
   * Round trip (FLT-12a): pass the OUTBOUND flight id - the whole booking uses its tier.
   */
  async getRefundPercentageForFlight(flightId: string, at: Date = new Date()): Promise<number> {
    const flight = await this.flightModel.findById(this.oid(flightId, 'flight id')).lean();
    if (!flight) throw new NotFoundException('Flight not found');
    const airline = await this.airlineModel.findById(flight.airlineId).lean();
    const days = Math.floor((flight.departureTime.getTime() - at.getTime()) / DAY_MS);
    return FlightsService.pickRefundPercentage(airline?.cancellationPolicy ?? [], days);
  }

  // ================================================================
  // FLT-03 / FLT-05 / FLT-06  Flights
  // ================================================================

  async createFlight(dto: CreateFlightDto, user: AuthUser) {
    if (user.role !== Role.AIRLINE_MODERATOR || !user.assignedProviderId) {
      throw new ForbiddenException('Only an airline moderator with an assigned airline can create flights');
    }
    const airline = await this.airlineModel.findById(user.assignedProviderId);
    if (!airline) throw new NotFoundException('Assigned airline not found');
    if (dto.originAirport === dto.destinationAirport) {
      throw new BadRequestException('Departure and arrival airports must be different');
    }

    const airports = await this.getAirports([dto.originAirport, dto.destinationAirport]);
    const origin = airports.get(dto.originAirport)!;
    const destination = airports.get(dto.destinationAirport)!;

    const departure = this.parseLocal(dto.departureTime, origin.timeZone, 'departureTime').toUTC().toJSDate();
    const arrival = this.parseLocal(dto.arrivalTime, destination.timeZone, 'arrivalTime').toUTC().toJSDate();
    this.assertValidSchedule(departure, arrival);

    try {
      const flight = await this.flightModel.create({
        flightNumber: dto.flightNumber,
        airlineId: airline._id,
        originAirport: dto.originAirport,
        destinationAirport: dto.destinationAirport,
        departureTime: departure,
        arrivalTime: arrival,
        departureLocalDate: this.localDate(departure, origin.timeZone),
      });
      return this.flightView(flight.toObject(), origin, destination);
    } catch (e) {
      throw this.mapDuplicate(
        e,
        'This airline already has a flight with this number on that departure date',
      );
    }
  }

  /** "Any booking" = at least one seat held or booked (no dependency on Member 3's schema). */
  private async hasSeatsTaken(flightId: Types.ObjectId): Promise<boolean> {
    const found = await this.cabinModel.exists({
      flightId,
      $expr: { $gt: [{ $add: ['$heldSeats', '$bookedSeats'] }, 0] },
    });
    return !!found;
  }

  async updateFlight(id: string, dto: UpdateFlightDto, user: AuthUser) {
    const flight = await this.loadOwnedFlight(id, user, true);

    const changesAirports = dto.originAirport !== undefined || dto.destinationAirport !== undefined;
    const changesTimes = dto.departureTime !== undefined || dto.arrivalTime !== undefined;
    if (!changesAirports && !changesTimes) throw new BadRequestException('Nothing to update');

    if (changesAirports) {
      if (flight.hasBookings || (await this.hasSeatsTaken(flight._id))) {
        throw new ConflictException('Airports cannot be changed once the flight has bookings');
      }
      if (dto.departureTime === undefined || dto.arrivalTime === undefined) {
        throw new BadRequestException(
          'When changing airports, send departureTime and arrivalTime again (local times)',
        );
      }
    }

    const originCode = dto.originAirport ?? flight.originAirport;
    const destinationCode = dto.destinationAirport ?? flight.destinationAirport;
    if (originCode === destinationCode) {
      throw new BadRequestException('Departure and arrival airports must be different');
    }
    const airports = await this.getAirports([originCode, destinationCode]);
    const origin = airports.get(originCode)!;
    const destination = airports.get(destinationCode)!;

    const oldDeparture = flight.departureTime;
    const oldArrival = flight.arrivalTime;
    const departure =
      dto.departureTime !== undefined
        ? this.parseLocal(dto.departureTime, origin.timeZone, 'departureTime').toUTC().toJSDate()
        : oldDeparture;
    const arrival =
      dto.arrivalTime !== undefined
        ? this.parseLocal(dto.arrivalTime, destination.timeZone, 'arrivalTime').toUTC().toJSDate()
        : oldArrival;
    this.assertValidSchedule(departure, arrival);

    flight.originAirport = originCode;
    flight.destinationAirport = destinationCode;
    flight.departureTime = departure;
    flight.arrivalTime = arrival;
    flight.departureLocalDate = this.localDate(departure, origin.timeZone);
    await this.saveDoc(
      flight,
      'This airline already has a flight with this number on that departure date',
    );

    const timesChanged =
      departure.getTime() !== oldDeparture.getTime() || arrival.getTime() !== oldArrival.getTime();
    if (timesChanged) {
      const payload: FlightScheduleChangedEvent = {
        flightId: flight.id,
        flightNumber: flight.flightNumber,
        oldDepartureTime: oldDeparture,
        oldArrivalTime: oldArrival,
        newDepartureTime: departure,
        newArrivalTime: arrival,
      };
      await this.emitSafe(FLIGHT_EVENTS.SCHEDULE_CHANGED, payload);
    }
    return this.flightView(flight.toObject(), origin, destination);
  }

  async cancelFlight(id: string, user: AuthUser) {
    const flight = await this.loadOwnedFlight(id, user);
    // atomic: two concurrent cancels can't both succeed
    const cancelled = await this.flightModel.findOneAndUpdate(
      { _id: flight._id, status: FlightStatus.SCHEDULED, departureTime: { $gt: new Date() } },
      { $set: { status: FlightStatus.CANCELLED } },
      { new: true },
    );
    if (!cancelled) throw new ConflictException('Only Scheduled flights can be cancelled');

    const payload: FlightCancelledEvent = { flightId: cancelled.id, flightNumber: cancelled.flightNumber };
    await this.emitSafe(FLIGHT_EVENTS.CANCELLED, payload);
    return cancelled;
  }

  // ---- FLT-30: Scheduled -> Departed (needs ScheduleModule.forRoot() in AppModule) ----
  @Cron(CronExpression.EVERY_MINUTE)
  async markDepartedFlights() {
    try {
      const due = await this.flightModel
        .find({ status: FlightStatus.SCHEDULED, departureTime: { $lte: new Date() } })
        .select('_id')
        .lean();
      if (!due.length) return;
      const ids = due.map((f) => f._id);
      await this.flightModel.updateMany(
        { _id: { $in: ids }, status: FlightStatus.SCHEDULED },
        { $set: { status: FlightStatus.DEPARTED } },
      );
      const payload: FlightDepartedEvent = { flightIds: ids.map(String) };
      await this.emitSafe(FLIGHT_EVENTS.DEPARTED, payload);
    } catch (e: any) {
      this.logger.error(`markDepartedFlights failed: ${e?.message ?? e}`);
    }
  }

  // ================================================================
  // FLT-04 / FLT-05  Cabins
  // ================================================================

  async addCabin(flightId: string, dto: CreateCabinDto, user: AuthUser) {
    const flight = await this.loadOwnedFlight(flightId, user, true);
    try {
      return await this.cabinModel.create({
        flightId: flight._id,
        cabinClass: dto.cabinClass,
        totalSeats: dto.totalSeats,
        price: dto.price,
        freeBags: dto.freeBags,
        maxWeightKg: dto.maxWeightKg,
      });
    } catch (e) {
      throw this.mapDuplicate(e, `This flight already has a ${dto.cabinClass} cabin`);
    }
  }

  async updateCabin(flightId: string, cabinId: string, dto: UpdateCabinDto, user: AuthUser) {
    const flight = await this.loadOwnedFlight(flightId, user, true);
    const filter: Record<string, any> = { _id: this.oid(cabinId, 'cabin id'), flightId: flight._id };
    const set: Record<string, number> = {};
    if (dto.price !== undefined) set.price = dto.price; // existing bookings keep their agreed price
    if (dto.freeBags !== undefined) set.freeBags = dto.freeBags;
    if (dto.maxWeightKg !== undefined) set.maxWeightKg = dto.maxWeightKg;
    if (dto.totalSeats !== undefined) {
      set.totalSeats = dto.totalSeats;
      // atomic: never below seats already booked or held
      filter.$expr = { $gte: [dto.totalSeats, { $add: ['$heldSeats', '$bookedSeats'] }] };
    }

    if (Object.keys(set).length === 0) {
      throw new BadRequestException('Send at least one of totalSeats, price, freeBags, maxWeightKg');
    }
    const cabin = await this.cabinModel.findOneAndUpdate(filter, { $set: set }, { new: true });
    if (!cabin) {
      const exists = await this.cabinModel.exists({ _id: filter._id, flightId: flight._id });
      if (!exists) throw new NotFoundException('Cabin not found on this flight');
      throw new BadRequestException('Cannot reduce seats below the seats already booked or held');
    }
    return cabin;
  }

  // ================================================================
  // Seat inventory API for Member 3 (FLT-22 / FLT-23 / FLT-26).
  // All atomic: held + booked can never exceed total.
  // ================================================================

  private assertSeatCount(seats: number) {
    if (!Number.isInteger(seats) || seats < 1) {
      throw new BadRequestException('seats must be a whole number >= 1');
    }
  }

  /** FLT-22: hold seats for a Pending Payment booking. */
  async reserveSeats(flightId: string, cabinClass: CabinClass, seats: number) {
    this.assertSeatCount(seats);
    const flight = await this.flightModel.findById(this.oid(flightId, 'flight id')).lean();
    if (
      !flight ||
      flight.status !== FlightStatus.SCHEDULED ||
      flight.departureTime.getTime() <= Date.now()
    ) {
      throw new ConflictException('This flight is not available for booking');
    }
    const airline = await this.airlineModel.findById(flight.airlineId).select('isActive').lean();
    if (!airline?.isActive) throw new ConflictException('This airline is not available for booking');

    const cabin = await this.cabinModel.findOneAndUpdate(
      {
        flightId: flight._id,
        cabinClass,
        $expr: {
          $gte: [{ $subtract: ['$totalSeats', { $add: ['$heldSeats', '$bookedSeats'] }] }, seats],
        },
      },
      { $inc: { heldSeats: seats } },
      { new: true },
    );
    if (!cabin) throw new ConflictException('Not enough seats available in this cabin');
    // FLT-05: from now on the flight's airports can never be changed
    await this.flightModel.updateOne({ _id: flight._id }, { $set: { hasBookings: true } });
    return cabin;
  }

  /** FLT-23: payment succeeded, held seats become booked seats. */
  async confirmSeats(flightId: string, cabinClass: CabinClass, seats: number) {
    this.assertSeatCount(seats);
    const cabin = await this.cabinModel.findOneAndUpdate(
      { flightId: this.oid(flightId, 'flight id'), cabinClass, heldSeats: { $gte: seats } },
      { $inc: { heldSeats: -seats, bookedSeats: seats } },
      { new: true },
    );
    if (!cabin) throw new ConflictException('Not enough held seats to confirm');
    return cabin;
  }

  /** FLT-22: hold expired or payment failed. */
  async releaseHeldSeats(flightId: string, cabinClass: CabinClass, seats: number) {
    this.assertSeatCount(seats);
    const cabin = await this.cabinModel.findOneAndUpdate(
      { flightId: this.oid(flightId, 'flight id'), cabinClass, heldSeats: { $gte: seats } },
      { $inc: { heldSeats: -seats } },
      { new: true },
    );
    if (!cabin) throw new ConflictException('Not enough held seats to release');
    return cabin;
  }

  /** FLT-26: a Confirmed booking was cancelled, seats go back to inventory. */
  async releaseBookedSeats(flightId: string, cabinClass: CabinClass, seats: number) {
    this.assertSeatCount(seats);
    const cabin = await this.cabinModel.findOneAndUpdate(
      { flightId: this.oid(flightId, 'flight id'), cabinClass, bookedSeats: { $gte: seats } },
      { $inc: { bookedSeats: -seats } },
      { new: true },
    );
    if (!cabin) throw new ConflictException('Not enough booked seats to release');
    return cabin;
  }

  /** Price + baggage of one cabin (for booking totals). */
  async getCabin(flightId: string, cabinClass: CabinClass) {
    const cabin = await this.cabinModel
      .findOne({ flightId: this.oid(flightId, 'flight id'), cabinClass })
      .lean();
    if (!cabin) throw new NotFoundException(`This flight has no ${cabinClass} cabin`);
    return cabin;
  }

  // ================================================================
  // FLT-11 / FLT-12 / FLT-15  Search
  // ================================================================

  private assertRealDate(value: string, label: string) {
    if (!DateTime.fromISO(value, { zone: 'utc' }).isValid) {
      throw new BadRequestException(`${label} is not a valid date`);
    }
  }

  async searchFlights(dto: SearchFlightsDto) {
    const adults = dto.adults ?? 1;
    const children = dto.children ?? 0;
    const infants = dto.infants ?? 0;
    if (infants > adults) {
      throw new BadRequestException('Each infant needs an adult: infants cannot exceed adults');
    }
    if (dto.minPrice !== undefined && dto.maxPrice !== undefined && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    }
    if (dto.origin === dto.destination) {
      throw new BadRequestException('Departure and arrival airports must be different');
    }
    this.assertRealDate(dto.departureDate, 'departureDate');
    if (dto.returnDate) {
      this.assertRealDate(dto.returnDate, 'returnDate');
      if (dto.returnDate < dto.departureDate) {
        throw new BadRequestException('returnDate cannot be before departureDate');
      }
    }

    const airports = await this.getAirports([dto.origin, dto.destination]);
    const origin = airports.get(dto.origin)!;
    const destination = airports.get(dto.destination)!;
    const seats = adults + children; // infants occupy no seat (FLT-12b)

    const outbound = await this.searchLeg(origin, destination, dto.departureDate, seats, dto);
    // FLT-12a: round trip = a second search with the route swapped
    const returnLeg = dto.returnDate
      ? await this.searchLeg(destination, origin, dto.returnDate, seats, dto)
      : null;
    return { outbound, return: returnLeg };
  }

  private async searchLeg(
    origin: AirportDocument,
    destination: AirportDocument,
    localDate: string,
    seats: number,
    dto: SearchFlightsDto,
  ) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;

    // a cabin qualifies when it has enough free seats and passes the optional filters
    const cabinConditions: any[] = [
      { $eq: ['$flightId', '$$fId'] },
      { $gte: [{ $subtract: ['$totalSeats', { $add: ['$heldSeats', '$bookedSeats'] }] }, seats] },
    ];
    if (dto.cabinClass) cabinConditions.push({ $eq: ['$cabinClass', dto.cabinClass] });
    if (dto.minPrice !== undefined) cabinConditions.push({ $gte: ['$price', dto.minPrice] });
    if (dto.maxPrice !== undefined) cabinConditions.push({ $lte: ['$price', dto.maxPrice] });

    const dir: 1 | -1 = dto.sortOrder === SortOrder.DESC ? -1 : 1;
    const sort: Record<string, 1 | -1> =
      dto.sortBy === FlightSortBy.PRICE
        ? { minPrice: dir, departureTime: 1, _id: 1 }
        : dto.sortBy === FlightSortBy.DURATION
          ? { durationMinutes: dir, departureTime: 1, _id: 1 }
          : { departureTime: dir, _id: 1 };

    const match: Record<string, any> = {
      status: FlightStatus.SCHEDULED,
      originAirport: origin.iataCode,
      destinationAirport: destination.iataCode,
      departureLocalDate: localDate,
      departureTime: { $gt: new Date() },
    };
    if (dto.airlineId) match.airlineId = this.oid(dto.airlineId, 'airlineId');

    const [res] = await this.flightModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: this.airlineModel.collection.name,
          localField: 'airlineId',
          foreignField: '_id',
          as: 'airline',
        },
      },
      { $unwind: '$airline' },
      { $match: { 'airline.isActive': true } },
      {
        $lookup: {
          from: this.cabinModel.collection.name,
          let: { fId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: cabinConditions } } },
            {
              $project: {
                _id: 0,
                cabinId: '$_id',
                cabinClass: 1,
                price: 1,
                freeBags: 1,
                maxWeightKg: 1,
                availableSeats: {
                  $subtract: ['$totalSeats', { $add: ['$heldSeats', '$bookedSeats'] }],
                },
              },
            },
            { $sort: { price: 1 } },
          ],
          as: 'cabins',
        },
      },
      { $match: { 'cabins.0': { $exists: true } } },
      {
        $addFields: {
          minPrice: { $min: '$cabins.price' },
          durationMinutes: { $divide: [{ $subtract: ['$arrivalTime', '$departureTime'] }, 60000] },
          // NB: $addFields MERGES into an existing embedded document, so the summary gets its
          // own field and the full airline document is dropped right after.
          airlineSummary: {
            _id: '$airline._id',
            name: '$airline.name',
            iataCode: '$airline.iataCode',
            logoUrl: '$airline.logoUrl',
          },
        },
      },
      { $project: { airline: 0 } },
      { $sort: sort },
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const total = res.total[0]?.count ?? 0;
    const infants = dto.infants ?? 0;
    // FLT-12b: adults + children pay the fare, infants pay 10 %; baggage fees are added at booking
    const totalFor = (fare: number) => Math.round((fare * seats + fare * 0.1 * infants) * 100) / 100;
    const data = res.data.map((f: any) => ({
      _id: f._id,
      flightNumber: f.flightNumber,
      status: f.status,
      airline: f.airlineSummary,
      origin: this.airportView(origin.iataCode, origin),
      destination: this.airportView(destination.iataCode, destination),
      departure: this.timeView(f.departureTime, origin.timeZone),
      arrival: this.timeView(f.arrivalTime, destination.timeZone),
      durationMinutes: Math.round(f.durationMinutes),
      minPrice: f.minPrice,
      cabins: f.cabins.map((c: any) => ({ ...c, totalPrice: totalFor(c.price) })),
    }));
    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      ...(total === 0 ? { message: 'No flights found' } : {}),
    };
  }

  // ================================================================
  // FLT-17  Flight details
  // ================================================================

  async getFlightById(id: string) {
    const flight: any = await this.flightModel
      .findById(this.oid(id, 'flight id'))
      .populate('airlineId', 'name iataCode logoUrl isActive baggagePolicy cancellationPolicy')
      .lean();
    if (!flight) throw new NotFoundException('Flight not found');

    const airports = await this.findAirportMap([flight.originAirport, flight.destinationAirport]);
    const cabins = await this.cabinModel.find({ flightId: flight._id }).sort({ price: 1 }).lean();
    const airline = flight.airlineId;
    if (!airline) throw new NotFoundException('Airline not found');
    const view = this.flightView(
      { ...flight, airlineId: airline._id },
      airports.get(flight.originAirport),
      airports.get(flight.destinationAirport),
    );

    return {
      _id: view._id,
      flightNumber: view.flightNumber,
      status: view.status,
      airline: { _id: airline._id, name: airline.name, iataCode: airline.iataCode, logoUrl: airline.logoUrl },
      origin: view.origin,
      destination: view.destination,
      departure: view.departure,
      arrival: view.arrival,
      durationMinutes: view.durationMinutes,
      cabins: cabins.map((c) => ({
        cabinId: c._id,
        cabinClass: c.cabinClass,
        price: c.price,
        availableSeats: c.totalSeats - c.heldSeats - c.bookedSeats,
        freeBags: c.freeBags,
        maxWeightKg: c.maxWeightKg,
      })),
      baggagePolicy: airline.baggagePolicy ?? null,
      cancellationPolicy: [...(airline.cancellationPolicy ?? [])].sort(
        (a: CancellationTier, b: CancellationTier) => b.daysBeforeDeparture - a.daysBeforeDeparture,
      ),
    };
  }

  // ================================================================
  // FLT-29  Bookings of a flight + passenger CSV (airline moderator)
  // ================================================================

  async getFlightBookings(flightId: string, user: AuthUser, p: PaginationDto) {
    const flight = await this.loadOwnedFlight(flightId, user);
    const page = p.page ?? 1;
    const limit = p.limit ?? 10;
    const [rows, cabins] = await Promise.all([
      this.bookingsReader.findByFlight(flightId),
      this.cabinModel.find({ flightId: flight._id }).lean(),
    ]);
    return {
      flightId: flight.id,
      flightNumber: flight.flightNumber,
      seatsRemaining: cabins.map((c) => ({
        cabinClass: c.cabinClass,
        totalSeats: c.totalSeats,
        availableSeats: c.totalSeats - c.heldSeats - c.bookedSeats,
      })),
      bookings: {
        data: rows.slice((page - 1) * limit, page * limit),
        page,
        limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / limit),
      },
    };
  }

  async exportPassengersCsv(flightId: string, user: AuthUser): Promise<string> {
    await this.loadOwnedFlight(flightId, user);
    const rows = await this.bookingsReader.findByFlight(flightId);

    // quotes escaped; leading = + - @ neutralised so Excel can't run a name as a formula
    const cell = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = ['Booking Reference,Passenger Name,Cabin,Seats,Status'];
    for (const b of rows) {
      for (const name of b.passengerNames) {
        lines.push([b.bookingReference, name, b.cabinClass, b.seats, b.status].map(cell).join(','));
      }
    }
    return '﻿' + lines.join('\n') + '\n'; // BOM so Excel shows Arabic names correctly
  }
}

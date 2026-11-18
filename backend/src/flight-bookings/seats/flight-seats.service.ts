import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import {
  CabinInventory,
  CabinInventoryDocument,
} from '../../flights/schemas/cabin-inventory.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { FLIGHT_BOOKING_EVENTS } from '../flight-bookings.events';
import type { FlightBookingCancelledEvent } from '../flight-bookings.events';
import {
  FlightBooking,
  FlightBookingDocument,
} from '../schemas/flight-booking.schema';
import { PassengerType, SegmentDirection } from '../schemas/flight-booking.enums';
import {
  MAX_SEAT_PICKS,
  SEAT_LOCK_HOURS,
  buildSeatLayout,
  isSeatLocked,
  normalizeSeat,
  pickSeatsForGroup,
  seatExists,
  seatLockTime,
} from './seat-layout';
import { SeatAssignment, SeatAssignmentDocument } from './schemas/seat-assignment.schema';
import { SelectSeatDto } from './dto/seat.dto';

const NOT_FOUND = 'Flight booking not found';
const BATCH = 200;

type BookingLean = FlightBooking & { _id: Types.ObjectId };
type SegmentLean = FlightBooking['segments'][number];
type Ctx = { booking: BookingLean; segment: SegmentLean; totalSeats: number };

/**
 * FLT-28: seat selection (bonus), after payment, on my own Confirmed booking.
 *
 *  - Choosing a seat is optional. Each adult and child can pick a seat up to 3 times in total
 *    (the first pick and two changes). Infants occupy no seat (FLT-12b). Seats are free.
 *  - Choosing and changing close 24 hours before departure. At that moment every passenger who
 *    has no seat gets one automatically (the group is kept together when possible).
 *  - Each flight of a round trip has its own seats, its own cut-off and its own 3 picks.
 *  - Seat uniqueness is enforced by the database (unique index), so two people picking the same
 *    seat at the same moment can never both get it: the second one gets a 409.
 */
@Injectable()
export class FlightSeatsService {
  private readonly logger = new Logger(FlightSeatsService.name);
  private assigning = false;

  constructor(
    @InjectModel(FlightBooking.name)
    private readonly bookingModel: Model<FlightBookingDocument>,
    @InjectModel(CabinInventory.name)
    private readonly cabinModel: Model<CabinInventoryDocument>,
    @InjectModel(SeatAssignment.name)
    private readonly seatModel: Model<SeatAssignmentDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  // ======================================================================
  // seat map
  // ======================================================================

  /** The seat map of one flight of my booking: every seat Available / Taken / Yours. */
  async getSeatMap(userId: string, id: string, segment = SegmentDirection.OUTBOUND) {
    const ctx = await this.load(userId, id, segment);
    const locked = isSeatLocked(ctx.segment.departureTime);
    // inside the last 24 hours the seats are final: give a seat to anyone who still has none
    if (locked) await this.autoAssign(ctx);

    const layout = buildSeatLayout(ctx.segment.cabinClass, ctx.totalSeats);
    const assigned = await this.seatModel
      .find({ flightId: ctx.segment.flightId, cabinClass: ctx.segment.cabinClass })
      .select('seat bookingId passengerIndex pickCount source')
      .lean()
      .exec();
    const taken = new Set(assigned.map((a) => a.seat));
    const mine = new Map(
      assigned
        .filter((a) => a.bookingId.equals(ctx.booking._id))
        .map((a) => [a.passengerIndex, a] as const),
    );
    const mySeats = new Set([...mine.values()].map((a) => a.seat));

    return {
      bookingId: ctx.booking._id.toString(),
      segment,
      flightNumber: ctx.segment.flightNumber,
      cabinClass: ctx.segment.cabinClass,
      departureTime: ctx.segment.departureTime,
      /** After this moment seats can no longer be chosen or changed. */
      seatChangesClosedAt: seatLockTime(ctx.segment.departureTime),
      locked,
      maxPicksPerPassenger: MAX_SEAT_PICKS,
      columns: layout.columns,
      aisleAfter: layout.aisleAfter,
      rows: layout.rows.map((r) => ({
        row: r.row,
        seats: r.seats.map((seat) => ({
          seat,
          status: mySeats.has(seat) ? 'yours' : taken.has(seat) ? 'taken' : 'available',
        })),
      })),
      passengers: ctx.booking.passengers.map((p, index) => {
        const a = mine.get(index);
        const needsSeat = p.type !== PassengerType.INFANT;
        return {
          index,
          fullName: p.fullName,
          type: p.type,
          needsSeat,
          seat: a?.seat ?? null,
          seatSource: a?.source ?? null,
          picksLeft: !needsSeat || locked ? 0 : Math.max(0, MAX_SEAT_PICKS - (a?.pickCount ?? 0)),
        };
      }),
    };
  }

  // ======================================================================
  // choose or change a seat
  // ======================================================================

  async selectSeat(userId: string, id: string, dto: SelectSeatDto) {
    const segment = dto.segment ?? SegmentDirection.OUTBOUND;
    const ctx = await this.load(userId, id, segment);
    if (isSeatLocked(ctx.segment.departureTime)) {
      throw new ConflictException(
        `Seat changes closed ${SEAT_LOCK_HOURS} hours before departure; your seats are assigned automatically`,
      );
    }
    const passenger = this.passengerOf(ctx.booking, dto.passengerIndex);
    const seat = normalizeSeat(dto.seat);
    if (!seatExists(ctx.segment.cabinClass, ctx.totalSeats, seat)) {
      throw new BadRequestException(`Seat ${seat} does not exist in ${ctx.segment.cabinClass}`);
    }

    const saved = await this.applyChoice(ctx, dto.passengerIndex, seat);
    return {
      bookingId: ctx.booking._id.toString(),
      segment,
      flightNumber: ctx.segment.flightNumber,
      cabinClass: ctx.segment.cabinClass,
      passengerIndex: dto.passengerIndex,
      passengerName: passenger.fullName,
      seat: saved.seat,
      picksLeft: Math.max(0, MAX_SEAT_PICKS - saved.pickCount),
    };
  }

  /**
   * One atomic write. A new seat is an insert, a change is an update that only matches while the
   * passenger still has picks left. The unique index turns "seat already taken" into a 409.
   */
  private async applyChoice(ctx: Ctx, passengerIndex: number, seat: string, retried = false): Promise<SeatAssignmentDocument> {
    const where = { bookingId: ctx.booking._id, flightId: ctx.segment.flightId, passengerIndex };
    const existing = await this.seatModel.findOne(where).exec();

    try {
      if (existing) {
        if (existing.seat === seat) return existing; // same seat again: nothing changes, no pick used
        const updated = await this.seatModel
          .findOneAndUpdate(
            { _id: existing._id, pickCount: { $lt: MAX_SEAT_PICKS } },
            { $set: { seat, cabinClass: ctx.segment.cabinClass, source: 'chosen' }, $inc: { pickCount: 1 } },
            { returnDocument: 'after' },
          )
          .exec();
        if (!updated) {
          throw new ConflictException(
            `You have already used all ${MAX_SEAT_PICKS} seat choices for this passenger`,
          );
        }
        return updated;
      }
      return await this.seatModel.create({
        ...where,
        cabinClass: ctx.segment.cabinClass,
        seat,
        pickCount: 1,
        source: 'chosen',
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const pattern = (error as { keyPattern?: Record<string, number> }).keyPattern ?? {};

      // the same passenger was written twice at the same moment: look again, once
      if (!retried && pattern.passengerIndex !== undefined) {
        return this.applyChoice(ctx, passengerIndex, seat, true);
      }
      // the seat belongs to someone else, unless that booking is no longer Confirmed
      if (!retried && (await this.freeIfStale(ctx, seat))) {
        return this.applyChoice(ctx, passengerIndex, seat, true);
      }
      throw new ConflictException(`Seat ${seat} is already taken, please choose another seat`);
    }
  }

  /** A seat held by a booking that is not Confirmed any more (a missed cleanup) is free again. */
  private async freeIfStale(ctx: Ctx, seat: string): Promise<boolean> {
    const holder = await this.seatModel
      .findOne({ flightId: ctx.segment.flightId, cabinClass: ctx.segment.cabinClass, seat })
      .lean()
      .exec();
    if (!holder || holder.bookingId.equals(ctx.booking._id)) return false;
    const owner = await this.bookingModel.findById(holder.bookingId).select('status').lean().exec();
    if (owner && owner.status === BookingStatus.CONFIRMED) return false;
    await this.seatModel.deleteOne({ _id: holder._id }).exec();
    return true;
  }

  // ======================================================================
  // automatic seats, 24 hours before departure
  // ======================================================================

  /** Every 10 minutes: bookings whose flight departs within 24 hours get seats for everyone. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoAssignDueSeats(): Promise<void> {
    if (this.assigning) return; // never overlap with a previous run
    this.assigning = true;
    try {
      const now = new Date();
      const bookings = (await this.bookingModel
        .find({
          status: BookingStatus.CONFIRMED,
          segments: {
            $elemMatch: {
              departureTime: { $gt: now, $lte: new Date(now.getTime() + SEAT_LOCK_HOURS * 3_600_000) },
              seatsLocked: { $ne: true },
            },
          },
        })
        .sort({ departureTime: 1 })
        .limit(BATCH)
        .lean()
        .exec()) as unknown as BookingLean[];

      let assigned = 0;
      for (const booking of bookings) {
        for (const segment of booking.segments) {
          if (segment.seatsLocked || !isSeatLocked(segment.departureTime, now)) continue;
          if (new Date(segment.departureTime).getTime() <= now.getTime()) continue;
          try {
            const cabin = await this.cabinFor(segment);
            if (!cabin) continue;
            assigned += await this.autoAssign({ booking, segment, totalSeats: cabin.totalSeats });
          } catch (error) {
            this.logger.error(
              `Automatic seats for booking ${booking._id.toString()} failed: ${(error as Error).message}`,
            );
          }
        }
      }
      if (assigned > 0) this.logger.log(`Assigned ${assigned} seat(s) automatically`);
    } catch (error) {
      this.logger.error(`Automatic seat job failed: ${(error as Error).message}`);
    } finally {
      this.assigning = false;
    }
  }

  /**
   * Gives a seat to every adult and child of this flight who has none, then marks the flight as
   * final. Safe to run twice at once: the unique indexes make a second writer simply skip.
   * Returns how many seats were given.
   */
  private async autoAssign(ctx: Ctx): Promise<number> {
    const layout = buildSeatLayout(ctx.segment.cabinClass, ctx.totalSeats);
    const given: Array<{ name: string; seat: string }> = [];
    let complete = false;

    for (let attempt = 0; attempt < 4 && !complete; attempt++) {
      const mine = await this.seatModel
        .find({ bookingId: ctx.booking._id, flightId: ctx.segment.flightId })
        .select('passengerIndex')
        .lean()
        .exec();
      const have = new Set(mine.map((a) => a.passengerIndex));
      const need = ctx.booking.passengers
        .map((p, index) => ({ p, index }))
        .filter(({ p, index }) => p.type !== PassengerType.INFANT && !have.has(index));
      if (need.length === 0) {
        complete = true;
        break;
      }

      const takenRows = await this.seatModel
        .find({ flightId: ctx.segment.flightId, cabinClass: ctx.segment.cabinClass })
        .select('seat')
        .lean()
        .exec();
      const seats = pickSeatsForGroup(layout, new Set(takenRows.map((t) => t.seat)), need.length);
      if (seats.length === 0) {
        this.logger.warn(
          `No free seat left on ${ctx.segment.flightNumber} ${ctx.segment.cabinClass} for booking ${ctx.booking._id.toString()}`,
        );
        break;
      }

      for (let k = 0; k < seats.length; k++) {
        try {
          await this.seatModel.create({
            bookingId: ctx.booking._id,
            flightId: ctx.segment.flightId,
            cabinClass: ctx.segment.cabinClass,
            passengerIndex: need[k].index,
            seat: seats[k],
            pickCount: 0,
            source: 'auto',
          });
          given.push({ name: need[k].p.fullName, seat: seats[k] });
        } catch (error) {
          if ((error as { code?: number }).code !== 11000) throw error; // someone else got it first: look again
        }
      }
    }

    if (complete) {
      await this.bookingModel
        .updateOne(
          { _id: ctx.booking._id, 'segments.flightId': ctx.segment.flightId },
          { $set: { 'segments.$.seatsLocked': true } },
        )
        .exec();
    }
    if (given.length > 0) {
      try {
        await this.notifications.notify({
          userId: ctx.booking.userId.toString(),
          type: 'FLIGHT_SEATS_ASSIGNED',
          title: 'Your seats were assigned',
          message:
            `Flight ${ctx.segment.flightNumber}: ` +
            given.map((g) => `${g.name} ${g.seat}`).join(', ') +
            `. Seat changes closed ${SEAT_LOCK_HOURS} hours before departure.`,
          related: { type: 'flight_booking', id: ctx.booking._id.toString() },
        });
      } catch (error) {
        this.logger.error(`Seat notification failed: ${(error as Error).message}`);
      }
    }
    return given.length;
  }

  // ======================================================================
  // cancelled booking
  // ======================================================================

  /** A cancelled booking gives all its seats back (user, airline or flight cancellation). */
  @OnEvent(FLIGHT_BOOKING_EVENTS.CANCELLED)
  async releaseSeatsOfCancelledBooking(event: FlightBookingCancelledEvent): Promise<void> {
    try {
      await this.seatModel.deleteMany({ bookingId: new Types.ObjectId(event.bookingId) }).exec();
    } catch (error) {
      this.logger.error(
        `Releasing the seats of cancelled booking ${event.bookingId} failed: ${(error as Error).message}`,
      );
    }
  }

  // ---------------- helpers ----------------

  private passengerOf(booking: BookingLean, index: number) {
    const passenger = booking.passengers[index];
    if (!passenger) throw new BadRequestException(`There is no passenger number ${index} in this booking`);
    if (passenger.type === PassengerType.INFANT) {
      throw new BadRequestException('Infants do not occupy a seat');
    }
    return passenger;
  }

  private cabinFor(segment: SegmentLean) {
    return this.cabinModel
      .findOne({ flightId: segment.flightId, cabinClass: segment.cabinClass })
      .select('totalSeats')
      .lean()
      .exec();
  }

  /** My own Confirmed booking, the chosen flight of it, before it departs, and its cabin size. */
  private async load(userId: string, id: string, direction: SegmentDirection): Promise<Ctx> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(NOT_FOUND);
    const booking = (await this.bookingModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .lean()
      .exec()) as unknown as BookingLean | null;
    if (!booking) throw new NotFoundException(NOT_FOUND);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('Seats can only be chosen for a Confirmed booking');
    }
    const segment = booking.segments.find((s) => s.direction === direction);
    if (!segment) throw new BadRequestException(`This booking has no ${direction} flight`);
    if (new Date(segment.departureTime).getTime() <= Date.now()) {
      throw new ConflictException('This flight has already departed');
    }
    const cabin = await this.cabinFor(segment);
    if (!cabin) throw new ConflictException('The cabin of this flight is no longer available');
    return { booking, segment, totalSeats: cabin.totalSeats };
  }
}

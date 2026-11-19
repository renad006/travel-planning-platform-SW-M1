import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Airline, AirlineDocument } from '../../flights/schemas/airline.schema';
import {
  CabinInventory,
  CabinInventoryDocument,
} from '../../flights/schemas/cabin-inventory.schema';
import { FlightsService } from '../../flights/flights.service';
import { Flight, FlightDocument, FlightStatus } from '../../flights/schemas/flight.schema';
import {
  NotificationsService,
  NotifyInput,
} from '../../notifications/notifications.service';
import { Airport, AirportDocument } from '../../reference-data/schemas/airport.schema';
import { HOLD_MINUTES, fareCentsFor, fromCents, toCents } from '../flight-bookings.rules';
import {
  FLIGHT_BOOKING_EVENTS,
  FlightBookingChangeExpiredEvent,
  FlightBookingFareReducedEvent,
} from '../flight-bookings.events';
import { FlightBookingsService } from '../flight-bookings.service';
import { FlightBooking, FlightBookingDocument } from '../schemas/flight-booking.schema';
import { SeatAssignment, SeatAssignmentDocument } from '../seats/schemas/seat-assignment.schema';
import { ChangeFlightDto } from './dto/change-flight.dto';
import type {
  PayableFlightChange,
  PayableFlightChangeService,
} from './payable-change.interface';
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
export class FlightChangesService implements PayableFlightChangeService {
  private readonly logger = new Logger(FlightChangesService.name);
  private expiring = false;

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
    @InjectModel(SeatAssignment.name)
    private readonly seatModel: Model<SeatAssignmentDocument>,
    private readonly flightsService: FlightsService,
    private readonly bookings: FlightBookingsService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
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
        const { reasons, seatsLeft, newFareCents, difference } = this.assess(
          ctx,
          direction,
          flight,
          cabin,
          localDate,
        );
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
          newFareSubtotal: newFareCents / 100,
          fareDifference: difference,
          canChange: reasons.length === 0,
          ...(reasons.length > 0 ? { reason: reasons.join('; ') } : {}),
        };
      });

    return { ...base, options };
  }


  /**
   * The fields that move ONE flight of a booking to another flight: the segment, the totals, the
   * passenger fares, the outbound departure and the end of the trip. Integer cents everywhere;
   * baggage never changes.
   */
  private switchFields(
    booking: BookingLean,
    direction: SegmentDirection,
    flight: FlightLean,
    farePerSeat: number,
    newCents: number,
  ) {
    const segment = booking.segments.find((s) => s.direction === direction) as SegmentLean;
    const paidCents = toCents(segment.fareSubtotal);
    const segments = booking.segments.map((s) =>
      s.direction === direction ? { ...s, farePerSeat } : s,
    );
    const fareTotalCents = toCents(booking.fareTotal) - paidCents + newCents;
    const totalCents = fareTotalCents + toCents(booking.baggageTotal ?? 0);

    const passengerFares: Record<string, number> = {};
    booking.passengers.forEach((p, index) => {
      const cents = segments.reduce(
        (sum, s) => sum + fareCentsFor(p.type, toCents(s.farePerSeat)),
        0,
      );
      passengerFares[`passengers.${index}.fare`] = fromCents(cents);
    });

    // the booking ends with its last flight: only a changed return (or a one-way) moves it
    const endsAt =
      direction === SegmentDirection.OUTBOUND && booking.segments.length > 1
        ? booking.endsAt
        : flight.arrivalTime;

    return {
      set: {
        'segments.$[seg].flightId': flight._id,
        'segments.$[seg].flightNumber': flight.flightNumber,
        'segments.$[seg].departureTime': flight.departureTime,
        'segments.$[seg].arrivalTime': flight.arrivalTime,
        'segments.$[seg].farePerSeat': farePerSeat,
        'segments.$[seg].fareSubtotal': fromCents(newCents),
        fareTotal: fromCents(fareTotalCents),
        totalPrice: fromCents(totalCents),
        departureTime:
          direction === SegmentDirection.OUTBOUND ? flight.departureTime : booking.departureTime,
        endsAt,
        ...passengerFares,
      } as Record<string, unknown>,
    };
  }

  // ======================================================================
  // a DEARER flight: the user pays the difference first
  // ======================================================================

  /**
   * The new flight costs more. Its seats are held for 10 minutes and a pending change is stored on
   * the booking; the booking itself stays on the old flight until Payments confirms the payment
   * (confirmChangeAfterPayment). Nothing is charged here: Member 5 charges `amountDue`.
   */
  private async startPaidChange(
    ctx: Awaited<ReturnType<FlightChangesService['loadChangeable']>>,
    direction: SegmentDirection,
    flight: FlightLean,
    farePerSeat: number,
    check: ReturnType<FlightChangesService['assess']>,
  ) {
    const { booking, segment } = ctx;
    const userId = booking.userId.toString();
    const bookingId = booking._id.toString();

    await this.flightsService.reserveSeats(
      flight._id.toString(),
      segment.cabinClass,
      booking.seatCount,
    );

    const now = new Date();
    const pending = {
      changeId: new Types.ObjectId(),
      direction,
      fromFlightId: segment.flightId,
      fromFlightNumber: segment.flightNumber,
      toFlightId: flight._id,
      toFlightNumber: flight.flightNumber,
      cabinClass: segment.cabinClass,
      oldFare: segment.fareSubtotal,
      newFare: fromCents(check.newFareCents),
      amountDue: check.difference.amount,
      farePerSeat,
      createdAt: now,
      holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
    };
    // atomic: only one pending change per booking, and only while it is still Confirmed on this flight
    const claimed = await this.bookingModel.findOneAndUpdate(
      {
        _id: booking._id,
        userId: booking.userId,
        status: BookingStatus.CONFIRMED,
        pendingChange: { $exists: false },
        segments: {
          $elemMatch: { direction, flightId: segment.flightId, departureTime: { $gt: now } },
        },
      },
      { $set: { pendingChange: pending } },
      { returnDocument: 'after' },
    );
    if (!claimed) {
      await this.safely(
        () =>
          this.flightsService.releaseHeldSeats(
            flight._id.toString(),
            segment.cabinClass,
            booking.seatCount,
          ),
        'return the held seats of the new flight',
      );
      throw new ConflictException('This booking can no longer be changed');
    }
    return this.bookings.get(userId, bookingId);
  }

  /** The user gives up an unpaid change to a dearer flight: its seats are released at once. */
  async cancelPendingChange(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(NOT_FOUND);
    const before = (await this.bookingModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
          status: BookingStatus.CONFIRMED,
          pendingChange: { $exists: true },
        },
        { $unset: { pendingChange: '' } },
        { returnDocument: 'before' },
      )
      .lean()
      .exec()) as unknown as BookingLean | null;
    if (!before?.pendingChange) {
      const exists = await this.bookingModel
        .exists({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
        .exec();
      if (!exists) throw new NotFoundException(NOT_FOUND);
      throw new ConflictException('No flight change is waiting for payment');
    }
    await this.endPendingChange(before, 'cancelled');
    return this.bookings.get(userId, id);
  }

  /** Seats of the new flight go back, Payments cancels the open payment of that change. */
  private async endPendingChange(booking: BookingLean, reason: 'expired' | 'cancelled') {
    const pending = booking.pendingChange;
    if (!pending) return;
    await this.safely(
      () =>
        this.flightsService.releaseHeldSeats(
          pending.toFlightId.toString(),
          pending.cabinClass,
          booking.seatCount,
        ),
      'return the held seats of the unpaid change',
    );
    const event: FlightBookingChangeExpiredEvent = {
      bookingId: booking._id.toString(),
      userId: booking.userId.toString(),
      changeId: pending.changeId.toString(),
      reason,
    };
    this.events.emit(FLIGHT_BOOKING_EVENTS.CHANGE_EXPIRED, event);
    if (reason === 'expired') {
      await this.safeNotify({
        userId: booking.userId.toString(),
        type: 'FLIGHT_CHANGE_EXPIRED',
        title: 'Flight change expired',
        message:
          `The change of your booking ${booking.reference ?? ''} to flight ${pending.toFlightNumber} ` +
          'was not paid in time, so it was cancelled. Your booking stays on flight ' +
          `${pending.fromFlightNumber}.`,
        related: { type: 'flight_booking', id: booking._id.toString() },
      });
    }
  }

  /** Expires ONE booking's unpaid change if its time is up (atomic: the seats go back only once). */
  private async expireDuePending(bookingId: Types.ObjectId): Promise<boolean> {
    const before = (await this.bookingModel
      .findOneAndUpdate(
        { _id: bookingId, 'pendingChange.holdExpiresAt': { $lte: new Date() } },
        { $unset: { pendingChange: '' } },
        { returnDocument: 'before' },
      )
      .lean()
      .exec()) as unknown as BookingLean | null;
    if (!before?.pendingChange) return false;
    await this.endPendingChange(before, 'expired');
    return true;
  }

  /** Every unpaid change whose 10 minutes are over. Returns how many were expired. */
  async expireDueChanges(batchSize = 200): Promise<number> {
    const due = await this.bookingModel
      .find({ 'pendingChange.holdExpiresAt': { $lte: new Date() } })
      .select('_id')
      .limit(batchSize)
      .lean()
      .exec();
    let count = 0;
    for (const row of due) {
      if (await this.expireDuePending(row._id as Types.ObjectId)) count += 1;
    }
    return count;
  }

  /** Runs every minute (ScheduleModule is registered by Member 2's FlightsModule). */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireChangesJob(): Promise<void> {
    if (this.expiring) return; // never overlap with a previous run
    this.expiring = true;
    try {
      const count = await this.expireDueChanges();
      if (count > 0) this.logger.log(`Expired ${count} unpaid flight change(s)`);
    } catch (error) {
      this.logger.error(`Flight change expiry job failed: ${(error as Error).message}`);
    } finally {
      this.expiring = false;
    }
  }

  // ======================================================================
  // contract for Payments (Member 5): changes/payable-change.interface.ts
  // ======================================================================

  /** What Payments needs to charge the price difference. No ownership check here: Payments does it. */
  async findPayableChange(bookingId: string, changeId: string): Promise<PayableFlightChange> {
    const noChange = () =>
      new NotFoundException('This flight change is no longer waiting for payment');
    if (!Types.ObjectId.isValid(bookingId) || !Types.ObjectId.isValid(changeId)) {
      throw new NotFoundException(NOT_FOUND);
    }
    const id = new Types.ObjectId(bookingId);
    await this.expireDuePending(id); // a change whose time is up is gone, whatever the job did
    const booking = (await this.bookingModel.findById(id).lean().exec()) as unknown as BookingLean | null;
    if (!booking) throw new NotFoundException(NOT_FOUND);
    const pending = booking.pendingChange;
    if (!pending || pending.changeId.toString() !== changeId || booking.status !== BookingStatus.CONFIRMED) {
      throw noChange();
    }
    return {
      bookingId: booking._id.toString(),
      changeId,
      ownerId: booking.userId.toString(),
      providerId: booking.airlineId.toString(),
      amount: pending.amountDue,
      currency: booking.currency,
      status: booking.status,
      holdExpiresAt: pending.holdExpiresAt,
      reference: booking.reference ?? '',
      description:
        `Flight change ${pending.fromFlightNumber} to ${pending.toFlightNumber} ` +
        `(booking ${booking.reference ?? booking._id.toString()})`,
    };
  }

  /**
   * The difference was paid: move the booking to the new flight. ATOMIC: the booking is switched
   * only if it still has THIS pending change, its time is not up and it is Confirmed on the old
   * flight. A redelivery of the same payment returns true again and changes nothing.
   */
  async confirmChangeAfterPayment(
    bookingId: string,
    changeId: string,
    paymentId: string,
  ): Promise<boolean> {
    const isId = (v: string) => /^[a-f\d]{24}$/i.test(v);
    if (!isId(bookingId) || !isId(changeId) || !isId(paymentId)) {
      throw new BadRequestException('bookingId, changeId and paymentId must be ids');
    }
    const id = new Types.ObjectId(bookingId);
    const alreadyPaid = (b: BookingLean | null) =>
      !!b?.changes?.some(
        (c) => c.changeId?.toString() === changeId && c.paymentId?.toString() === paymentId,
      );

    const existing = (await this.bookingModel.findById(id).lean().exec()) as unknown as BookingLean | null;
    if (!existing) {
      this.logger.warn(`Payment ${paymentId} succeeded for unknown flight booking ${bookingId}`);
      return false;
    }
    if (alreadyPaid(existing)) return true; // webhook redelivery
    const pending = existing.pendingChange;
    if (existing.status !== BookingStatus.CONFIRMED || !pending || pending.changeId.toString() !== changeId) {
      return false;
    }
    if (pending.holdExpiresAt.getTime() <= Date.now()) {
      await this.expireDuePending(id); // the job has not run yet: expire it now
      return false;
    }

    // the new flight must still be bookable and still fit a round trip (schedules can change)
    const flight = (await this.flightModel
      .findById(pending.toFlightId)
      .lean()
      .exec()) as unknown as FlightLean | null;
    const segment = existing.segments.find(
      (s) => s.direction === pending.direction && s.flightId.equals(pending.fromFlightId),
    );
    const other = existing.segments.find((s) => s.direction !== pending.direction) ?? null;
    if (
      !flight ||
      !segment ||
      flight.status !== FlightStatus.SCHEDULED ||
      flight.departureTime.getTime() <= Date.now() ||
      segmentOrderProblem(pending.direction, flight, other)
    ) {
      this.logger.warn(`Paid flight change ${changeId} of booking ${bookingId} can no longer be applied`);
      return false;
    }

    const newCents = segmentFareCents(existing.passengers, toCents(pending.farePerSeat));
    const sw = this.switchFields(existing, pending.direction, flight, pending.farePerSeat, newCents);
    const now = new Date();
    const claimed = await this.bookingModel.findOneAndUpdate(
      {
        _id: id,
        status: BookingStatus.CONFIRMED,
        'pendingChange.changeId': pending.changeId,
        'pendingChange.holdExpiresAt': { $gt: now },
        segments: {
          $elemMatch: { direction: pending.direction, flightId: pending.fromFlightId },
        },
      },
      {
        $set: sw.set,
        $unset: { pendingChange: '', 'segments.$[seg].seatsLocked': '' },
        $push: {
          extraPaymentIds: new Types.ObjectId(paymentId),
          changes: {
            at: now,
            direction: pending.direction,
            fromFlightId: pending.fromFlightId,
            fromFlightNumber: pending.fromFlightNumber,
            toFlightId: pending.toFlightId,
            toFlightNumber: pending.toFlightNumber,
            oldFare: pending.oldFare,
            newFare: fromCents(newCents),
            fareDirection: 'pay',
            refundAmount: 0,
            amountPaid: pending.amountDue,
            changeId: pending.changeId,
            paymentId: new Types.ObjectId(paymentId),
          },
        },
      },
      {
        returnDocument: 'after',
        arrayFilters: [{ 'seg.direction': pending.direction, 'seg.flightId': pending.fromFlightId }],
      },
    );
    if (!claimed) {
      // lost a race (expired, cancelled or paid by a parallel call): true only if THIS payment did it
      const current = (await this.bookingModel.findById(id).lean().exec()) as unknown as BookingLean | null;
      return alreadyPaid(current);
    }

    const record = claimed.toObject() as unknown as BookingLean;
    try {
      await this.flightsService.confirmSeats(
        pending.toFlightId.toString(),
        pending.cabinClass,
        record.seatCount,
      );
    } catch (error) {
      // Should be impossible: the seats were held for this change.
      this.logger.error(
        `CRITICAL: booking ${bookingId} moved to ${pending.toFlightNumber} but its held seats could not ` +
          `be made booked: ${(error as Error).message}`,
      );
    }
    await this.safely(
      () =>
        this.flightsService.releaseBookedSeats(
          pending.fromFlightId.toString(),
          pending.cabinClass,
          record.seatCount,
        ),
      'return the seats of the old flight',
    );
    await this.safely(
      () => this.seatModel.deleteMany({ bookingId: id, flightId: pending.fromFlightId }).exec(),
      'clear the seats chosen on the old flight',
    );
    await this.safeNotify({
      userId: record.userId.toString(),
      type: 'FLIGHT_BOOKING_CHANGED',
      title: 'Flight changed',
      message:
        `Your booking ${record.reference}: ${pending.direction} flight ${pending.fromFlightNumber} was changed to ` +
        `${pending.toFlightNumber}. You paid ${pending.amountDue.toFixed(2)} ${record.currency} for the difference. ` +
        'Seats you chose on the old flight were cleared: you can choose seats again on the new flight.',
      related: { type: 'flight_booking', id: bookingId },
    });
    return true;
  }

  /**
   * The rules every new flight must satisfy, used by the options list AND by the change itself, so
   * what the user is shown is exactly what is accepted. `reasons` is empty when the flight is fine.
   */
  private assess(
    ctx: Awaited<ReturnType<FlightChangesService['loadChangeable']>>,
    direction: SegmentDirection,
    flight: FlightLean,
    cabin: (CabinInventory & { _id: Types.ObjectId }) | undefined,
    localDate: string,
  ) {
    const { booking, segment, other } = ctx;
    const paidCents = toCents(segment.fareSubtotal);
    const reasons: string[] = [];
    let seatsLeft = 0;
    let newFareCents = 0;
    let difference = fareDifference(paidCents, paidCents);

    const numbers = cabin
      ? [cabin.totalSeats, cabin.heldSeats, cabin.bookedSeats, cabin.price, cabin.maxWeightKg]
      : [];
    if (!cabin || numbers.some((v) => typeof v !== 'number')) {
      // an old data format (missing seat or baggage fields): cannot be booked yet
      reasons.push(`The ${segment.cabinClass} cabin of this flight is not ready for booking`);
    } else {
      seatsLeft = cabin.totalSeats - cabin.heldSeats - cabin.bookedSeats;
      newFareCents = segmentFareCents(booking.passengers, toCents(cabin.price));
      difference = fareDifference(paidCents, newFareCents);

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
    return { reasons, seatsLeft, newFareCents, difference };
  }

  // ======================================================================
  // the change itself (same price or cheaper)
  // ======================================================================

  /**
   * FLT-27: move ONE flight of my Confirmed booking to another flight of the same airline, route
   * and cabin. Same price or cheaper only (a dearer flight needs a payment: later step).
   *
   * Order matters so seats are never lost or double counted:
   *   1. take the seats on the NEW flight (held, then booked),
   *   2. switch the booking in ONE atomic update (only if it is still Confirmed on the old flight),
   *   3. give the seats of the OLD flight back and clear the seats chosen there (FLT-28).
   * If step 2 loses a race (cancelled or changed at the same moment) the new seats are returned.
   */
  async changeFlight(userId: string, id: string, dto: ChangeFlightDto) {
    const direction = dto.segment ?? SegmentDirection.OUTBOUND;
    // an unpaid change that ran out of time must not block a new one while the job has not run yet
    if (Types.ObjectId.isValid(id)) await this.expireDuePending(new Types.ObjectId(id));
    const ctx = await this.loadChangeable(userId, id, direction);
    const { booking, segment, currentFlight } = ctx;

    if (booking.pendingChange) {
      throw new ConflictException(
        `A change to flight ${booking.pendingChange.toFlightNumber} is waiting for payment. ` +
          'Pay it, cancel it (DELETE /change-flight) or wait until it expires.',
      );
    }
    if (dto.flightId === segment.flightId.toString()) {
      throw new BadRequestException('The booking is already on this flight');
    }
    const flight = (await this.flightModel
      .findById(dto.flightId)
      .lean()
      .exec()) as unknown as FlightLean | null;
    if (!flight) throw new NotFoundException('Flight not found');
    if (
      !flight.airlineId.equals(currentFlight.airlineId) ||
      flight.originAirport !== segment.originAirport ||
      flight.destinationAirport !== segment.destinationAirport
    ) {
      throw new BadRequestException(
        'You can only change to a flight of the same airline on the same route',
      );
    }
    if (flight.status !== FlightStatus.SCHEDULED || flight.departureTime.getTime() <= Date.now()) {
      throw new ConflictException('This flight is not available for booking');
    }
    const cabin = await this.cabinModel
      .findOne({ flightId: flight._id, cabinClass: segment.cabinClass })
      .lean()
      .exec();
    if (!cabin) {
      throw new ConflictException(`This flight has no ${segment.cabinClass} cabin`);
    }

    const timeZone = await this.timeZoneOf(segment.originAirport);
    const localDate = this.localDateOf(flight, timeZone);
    const check = this.assess(ctx, direction, flight, cabin, localDate);
    if (check.reasons.length > 0) throw new ConflictException(check.reasons.join('; '));
    if (check.difference.direction === 'pay') {
      return this.startPaidChange(ctx, direction, flight, cabin.price, check);
    }

    // ---- 1. seats on the new flight ----
    await this.flightsService.reserveSeats(dto.flightId, segment.cabinClass, booking.seatCount);
    try {
      await this.flightsService.confirmSeats(dto.flightId, segment.cabinClass, booking.seatCount);
    } catch (error) {
      await this.safely(
        () =>
          this.flightsService.releaseHeldSeats(dto.flightId, segment.cabinClass, booking.seatCount),
        'return the held seats of the new flight',
      );
      throw error;
    }

    // ---- money (integer cents): only this flight's fare changes, baggage stays ----
    const paidCents = toCents(segment.fareSubtotal);
    const newCents = check.newFareCents;
    const refundAmount = Math.max(0, paidCents - newCents) / 100;
    const now = new Date();
    const sw = this.switchFields(booking, direction, flight, cabin.price, newCents);

    // ---- 2. one atomic switch ----
    const claimed = await this.bookingModel.findOneAndUpdate(
      {
        _id: booking._id,
        userId: booking.userId,
        status: BookingStatus.CONFIRMED,
        segments: {
          $elemMatch: {
            direction,
            flightId: segment.flightId,
            departureTime: { $gt: now },
          },
        },
      },
      {
        $set: sw.set,
        $unset: { 'segments.$[seg].seatsLocked': '' },
        $push: {
          changes: {
            at: now,
            direction,
            fromFlightId: segment.flightId,
            fromFlightNumber: segment.flightNumber,
            toFlightId: flight._id,
            toFlightNumber: flight.flightNumber,
            oldFare: fromCents(paidCents),
            newFare: fromCents(newCents),
            fareDirection: refundAmount > 0 ? 'refund' : 'none',
            refundAmount,
          },
        },
      },
      {
        returnDocument: 'after',
        arrayFilters: [{ 'seg.direction': direction, 'seg.flightId': segment.flightId }],
      },
    );
    if (!claimed) {
      await this.safely(
        () =>
          this.flightsService.releaseBookedSeats(dto.flightId, segment.cabinClass, booking.seatCount),
        'return the seats of the new flight',
      );
      throw new ConflictException('This booking can no longer be changed');
    }

    // ---- 3. the old flight ----
    await this.safely(
      () =>
        this.flightsService.releaseBookedSeats(
          segment.flightId.toString(),
          segment.cabinClass,
          booking.seatCount,
        ),
      'return the seats of the old flight',
    );
    // seats chosen on the old flight (FLT-28) no longer exist: the user picks again
    await this.safely(
      () => this.seatModel.deleteMany({ bookingId: booking._id, flightId: segment.flightId }).exec(),
      'clear the seats chosen on the old flight',
    );

    const record = claimed.toObject();
    if (refundAmount > 0) {
      const event: FlightBookingFareReducedEvent = {
        bookingId: booking._id.toString(),
        userId,
        reference: record.reference ?? '',
        paymentId: record.paymentId?.toString(),
        amount: refundAmount,
        currency: record.currency,
        changedAt: now,
      };
      this.events.emit(FLIGHT_BOOKING_EVENTS.FARE_REDUCED, event);
    }

    await this.safeNotify({
      userId,
      type: 'FLIGHT_BOOKING_CHANGED',
      title: 'Flight changed',
      message:
        `Your booking ${record.reference}: ${direction} flight ${segment.flightNumber} was changed to ` +
        `${flight.flightNumber}. ` +
        (refundAmount > 0
          ? `The new flight is cheaper: ${refundAmount.toFixed(2)} ${record.currency} will be refunded to you. `
          : 'The price is the same. ') +
        'Seats you chose on the old flight were cleared: you can choose seats again on the new flight.',
      related: { type: 'flight_booking', id: booking._id.toString() },
    });

    return this.bookings.get(userId, id);
  }

  /** A step after the change was saved must never undo it: log the problem and go on. */
  private async safely(step: () => Promise<unknown>, what: string): Promise<void> {
    try {
      await step();
    } catch (error) {
      this.logger.error(`Could not ${what}: ${(error as Error).message}`);
    }
  }

  private async safeNotify(input: NotifyInput): Promise<void> {
    try {
      await this.notifications.notify(input);
    } catch (error) {
      this.logger.error(`Notification "${input.type}" failed: ${(error as Error).message}`);
    }
  }

  // ======================================================================
  // helpers (shared by the options list and the change)
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

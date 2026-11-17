import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, isValidObjectId, Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { BookingType } from '../payments/enums/payment.enums';
import { calculateRefund } from '../payments/refund-calculator';
import {
  HOTEL_BOOKING_EVENTS,
  type HotelBookingCancelledEvent,
  type HotelBookingExpiredEvent,
} from './hotel-bookings.events';
import type {
  PayableBooking,
  PayableBookingService,
} from '../payments/payable-booking.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { nightsOf, parseStay } from '../common/utils/stay.util';
import { Hotel, HotelDocument } from '../hotels/schemas/hotel.schema';
import {
  RoomAvailability,
  RoomAvailabilityDocument,
} from '../hotels/schemas/room-availability.schema';
import {
  RoomBlock,
  RoomBlockDocument,
} from '../hotels/schemas/room-block.schema';
import { Room, RoomDocument } from '../hotels/schemas/room.schema';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import {
  HotelBooking,
  HotelBookingDocument,
  HotelCancelledBy,
} from './schemas/hotel-booking.schema';
import {
  RoomNightLock,
  RoomNightLockDocument,
} from './schemas/room-night-lock.schema';

const HOLD_MINUTES = 10;
const EXPIRY_CHECK_MS = 60_000;

@Injectable()
export class HotelBookingsService
  implements OnModuleInit, OnModuleDestroy, PayableBookingService
{
  private readonly logger = new Logger(HotelBookingsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(HotelBooking.name)
    private readonly bookingModel: Model<HotelBookingDocument>,
    @InjectModel(RoomNightLock.name)
    private readonly lockModel: Model<RoomNightLockDocument>,
    @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(RoomAvailability.name)
    private readonly availabilityModel: Model<RoomAvailabilityDocument>,
    @InjectModel(RoomBlock.name)
    private readonly blockModel: Model<RoomBlockDocument>,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  /** PAY-04: the one platform currency, read from the same config as Payments. */
  private get platformCurrency(): string {
    return this.config.get<string>('defaultCurrency') ?? 'USD';
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      this.expireHolds().catch((e: unknown) =>
        this.logger.error('Could not expire holds', e),
      );
      this.completeStays().catch((e: unknown) =>
        this.logger.error('Could not complete stays', e),
      );
    }, EXPIRY_CHECK_MS);
  }

  // A Confirmed reservation whose check-out day has passed becomes Completed
  // (Member 5's reviews, HTL-23/24, only accept Completed stays).
  async completeStays() {
    await this.bookingModel.updateMany(
      { status: BookingStatus.CONFIRMED, checkOut: { $lt: new Date() } },
      { status: BookingStatus.COMPLETED },
    );
  }

  // TEST ONLY: same path the payment webhook uses, with a made-up payment id
  async testConfirm(id: string) {
    const confirmed = await this.confirmAfterPayment(
      id,
      new Types.ObjectId().toString(),
    );
    if (!confirmed) {
      throw new ConflictException('This reservation is not awaiting payment');
    }
    return this.bookingModel.findById(id);
  }

  // TEST ONLY: skip the wait for check-out so reviews can be tested right away
  async testComplete(id: string) {
    const booking = isValidObjectId(id)
      ? await this.bookingModel.findOneAndUpdate(
          { _id: id, status: BookingStatus.CONFIRMED },
          { status: BookingStatus.COMPLETED },
          { returnDocument: 'after' },
        )
      : null;
    if (!booking) {
      throw new ConflictException('This reservation is not confirmed');
    }
    return booking;
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // HTL-18: an unpaid reservation becomes Expired after the hold and frees its nights
  async expireHolds() {
    const expired = await this.bookingModel
      .find({
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { $lt: new Date() },
      })
      .select('_id')
      .exec();
    // shortcut: one by one, fine for the few holds that end within a minute
    for (const booking of expired) {
      await this.expireHold(booking.id as string);
    }
  }

  // PayableBookingService: Pending Payment -> Expired, and free the rooms. The expired
  // event tells Payments (Member 5) to cancel the open Stripe PaymentIntent, same as flights.
  async expireHold(id: string): Promise<void> {
    const expired = await this.bookingModel.findOneAndUpdate(
      { _id: id, status: BookingStatus.PENDING_PAYMENT },
      { status: BookingStatus.EXPIRED },
    );
    if (expired) {
      await this.lockModel.deleteMany({ bookingId: expired._id });
      const event: HotelBookingExpiredEvent = {
        bookingId: expired.id as string,
        userId: expired.userId.toString(),
        paymentId: expired.paymentId?.toString(),
      };
      this.events.emit(HOTEL_BOOKING_EVENTS.EXPIRED, event);
    }
  }

  // PayableBookingService: what Payments needs to know about a hotel booking
  async findPayable(id: string): Promise<PayableBooking> {
    const booking = isValidObjectId(id)
      ? await this.bookingModel.findById(id).exec()
      : null;
    if (!booking) {
      throw new NotFoundException('Reservation not found');
    }
    const snapshot = booking.policiesSnapshot;
    return {
      id: booking.id as string,
      type: BookingType.HOTEL,
      ownerId: booking.userId.toString(),
      providerId: booking.hotelId.toString(),
      amount: booking.totalPrice,
      currency: booking.currency ?? this.platformCurrency, // older bookings have none stored
      status: booking.status,
      holdExpiresAt: booking.holdExpiresAt ?? null,
      policiesAcceptedAt: booking.policiesAcceptedAt ?? null,
      cancellationAnchor: booking.checkIn,
      cancellationTiers: snapshot?.cancellationTiers ?? [],
      policySnapshot: {
        cancellationTiers: snapshot?.cancellationTiers ?? [],
        checkInTime: snapshot?.checkInTime ?? null,
        checkOutTime: snapshot?.checkOutTime ?? null,
      },
    };
  }

  // PayableBookingService: PAY-02, store when the user accepted the policies
  async markPoliciesAccepted(id: string, acceptedAt: Date): Promise<void> {
    const booking = isValidObjectId(id)
      ? await this.bookingModel.findByIdAndUpdate(id, {
          policiesAcceptedAt: acceptedAt,
        })
      : null;
    if (!booking) {
      throw new NotFoundException('Reservation not found');
    }
  }

  // HTL-17, PayableBookingService. Member 5 calls this from the Stripe webhook after
  // payment_intent.succeeded. Atomic: only a booking still in Pending Payment becomes
  // Confirmed (with confirmedAt, paymentId and the HTL- reference) and the user is
  // notified. Returns false if the booking was no longer pending (or its hold already
  // ended, which expires it now), then Payments refunds 100%. Same payment delivered
  // twice (Stripe redelivery) returns true, a different payment returns false.
  async confirmAfterPayment(id: string, paymentId: string): Promise<boolean> {
    if (!isValidObjectId(paymentId)) {
      throw new BadRequestException(
        'paymentId must be the id of the Payment document',
      );
    }
    const existing = isValidObjectId(id)
      ? await this.bookingModel.findById(id)
      : null;
    if (!existing) {
      this.logger.warn(`Payment ${paymentId} succeeded for unknown hotel booking ${id}`);
      return false;
    }
    if (existing.status === BookingStatus.CONFIRMED) {
      return existing.paymentId?.toString() === paymentId;
    }
    if (existing.status !== BookingStatus.PENDING_PAYMENT) {
      return false;
    }
    if (existing.holdExpiresAt && existing.holdExpiresAt.getTime() <= Date.now()) {
      await this.expireHold(id); // the timer has not run yet: expire it now
      return false;
    }

    // shortcut: a random 10-hex reference, a clash is rejected by the unique index, not retried
    const reference = `HTL-${randomBytes(5).toString('hex').toUpperCase()}`;
    // the status in the filter keeps this atomic if the timer expires it at the same moment
    const booking = await this.bookingModel.findOneAndUpdate(
      { _id: id, status: BookingStatus.PENDING_PAYMENT },
      {
        status: BookingStatus.CONFIRMED,
        confirmedAt: new Date(),
        paymentId,
        reference,
      },
      { returnDocument: 'after' },
    );
    if (!booking) {
      return false;
    }
    const hotel = await this.hotelModel.findById(booking.hotelId);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    await this.notifications.notify({
      userId: booking.userId.toString(),
      type: 'BOOKING_CONFIRMED',
      title: 'Hotel reservation confirmed',
      message: `Reservation ${reference} at ${hotel?.name ?? 'your hotel'}, ${day(booking.checkIn)} to ${day(booking.checkOut)}, total ${booking.totalPrice}.`,
      related: { type: 'hotel_booking', id: booking.id as string },
    });
    return true;
  }

  // HTL-21: your own Confirmed reservation, still before check-in
  private async findCancellable(userId: string, id: string) {
    const booking = isValidObjectId(id)
      ? await this.bookingModel.findOne({ _id: id, userId })
      : null;
    // someone else's reservation is reported as not found, never as forbidden
    if (!booking) {
      throw new NotFoundException('Reservation not found');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('Only a Confirmed reservation can be cancelled');
    }
    if (booking.checkIn.getTime() <= Date.now()) {
      throw new ConflictException(
        'The check-in date has passed, this reservation can no longer be cancelled',
      );
    }
    return booking;
  }

  // PAY-03 formula (Member 5): the tier with the highest threshold not above the days left
  private refundFor(booking: HotelBookingDocument) {
    const result = calculateRefund({
      tiers: booking.policiesSnapshot?.cancellationTiers ?? [],
      bookingAmount: booking.totalPrice,
      cancellationAnchor: booking.checkIn,
    });
    return {
      percent: result.percent,
      amount: result.amount,
      daysRemaining: result.daysRemaining,
      currency: booking.currency ?? this.platformCurrency,
    };
  }

  // HTL-21: the refund the user would get if they cancel now, shown before confirming
  async refundPreview(userId: string, id: string) {
    return this.refundFor(await this.findCancellable(userId, id));
  }

  // HTL-21: cancel the whole reservation. The rooms are released in the same transaction
  // and Payments (Member 5) is told through the cancelled event to create the refund.
  async cancel(userId: string, id: string) {
    const booking = await this.findCancellable(userId, id);
    const refund = this.refundFor(booking);

    const session = await this.connection.startSession();
    try {
      let claimed = null as HotelBookingDocument | null;
      await session.withTransaction(async () => {
        // only one concurrent cancel can win, so the nights are never released twice
        claimed = await this.bookingModel.findOneAndUpdate(
          {
            _id: booking._id,
            userId: booking.userId,
            status: BookingStatus.CONFIRMED,
            checkIn: { $gt: new Date() },
          },
          {
            status: BookingStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledBy: HotelCancelledBy.USER,
            refundPercentage: refund.percent,
            refundAmount: refund.amount,
          },
          { returnDocument: 'after', session },
        );
        if (claimed) {
          await this.lockModel.deleteMany({ bookingId: claimed._id }, { session });
        }
      });
      if (!claimed) {
        throw new ConflictException('This reservation can no longer be cancelled');
      }
      const cancelled = claimed;

      await this.notifications.notify({
        userId,
        type: 'BOOKING_CANCELLED',
        title: 'Hotel reservation cancelled',
        message:
          `Reservation ${cancelled.reference ?? ''} was cancelled. ` +
          (refund.amount > 0
            ? `A refund of ${refund.amount} ${refund.currency} applies under the cancellation policy.`
            : 'No refund applies under the cancellation policy.'),
        related: { type: 'hotel_booking', id: cancelled.id as string },
      });
      const event: HotelBookingCancelledEvent = {
        bookingId: cancelled.id as string,
        userId,
        reference: cancelled.reference ?? '',
        paymentId: cancelled.paymentId?.toString(),
        cancelledBy: 'user',
        amount: cancelled.totalPrice,
        currency: refund.currency,
        cancellationAnchor: cancelled.checkIn,
        cancellationTiers: cancelled.policiesSnapshot?.cancellationTiers ?? [],
      };
      this.events.emit(HOTEL_BOOKING_EVENTS.CANCELLED, event);
      return { booking: cancelled, refund };
    } finally {
      await session.endSession();
    }
  }

  // HTL-20: the user's reservations grouped as Upcoming, Past and Cancelled.
  // Pending Payment and Expired are unpaid attempts, so they are not listed.
  async listMine(userId: string) {
    const bookings = await this.bookingModel
      .find({
        userId,
        status: {
          $in: [
            BookingStatus.CONFIRMED,
            BookingStatus.COMPLETED,
            BookingStatus.CANCELLED,
          ],
        },
      })
      .sort({ checkIn: 1 })
      .populate('hotelId', 'name')
      .populate('rooms.roomId', 'name type')
      .exec();
    const now = new Date();
    return {
      upcoming: bookings.filter(
        (b) => b.status === BookingStatus.CONFIRMED && b.checkOut > now,
      ),
      past: bookings
        .filter(
          (b) =>
            b.status === BookingStatus.COMPLETED ||
            (b.status === BookingStatus.CONFIRMED && b.checkOut <= now),
        )
        .reverse(),
      cancelled: bookings.filter((b) => b.status === BookingStatus.CANCELLED),
    };
  }

  // HTL-20: full details of one of the user's own reservations
  async findMine(userId: string, id: string) {
    const booking = isValidObjectId(id)
      ? await this.bookingModel
          .findOne({ _id: id, userId })
          .populate('hotelId', 'name address checkInTime checkOutTime')
          .populate('rooms.roomId', 'name type')
          .exec()
      : null;
    // someone else's reservation is reported as not found, never as forbidden
    if (!booking) {
      throw new NotFoundException('Reservation not found');
    }
    return booking;
  }

  // ITN-27: what the itinerary needs to link one of the user's reservations to a day
  async findForItinerary(userId: string, id: string) {
    const booking = await this.findMine(userId, id);
    return {
      id: booking.id as string,
      hotelName: (booking.hotelId as unknown as { name?: string }).name ?? 'Hotel',
      status: booking.status,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalPrice: booking.totalPrice,
      currency: booking.currency ?? this.platformCurrency,
    };
  }

  // HTL-16 + HTL-18: hold all selected rooms together as one Pending Payment reservation
  async create(userId: string, dto: CreateHotelBookingDto) {
    const { checkIn, checkOut } = parseStay(dto.checkIn, dto.checkOut);
    const hotel = await this.hotelModel.findOne({
      _id: dto.hotelId,
      isActive: true,
    });
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    const entries = dto.rooms.map((r) => ({
      ...r,
      roomId: r.roomId.toLowerCase(),
    }));
    const roomIds = entries.map((r) => r.roomId);
    if (new Set(roomIds).size !== roomIds.length) {
      throw new BadRequestException('Each room can only be listed once');
    }
    if (!entries.some((r) => r.adults >= 1)) {
      throw new BadRequestException('At least one adult is required');
    }

    const rooms = await this.roomModel.find({
      _id: { $in: roomIds },
      hotelId: dto.hotelId,
      isActive: true,
    });
    if (rooms.length !== roomIds.length) {
      throw new NotFoundException('One or more rooms were not found in this hotel');
    }
    const roomById = new Map(rooms.map((r) => [r.id as string, r]));

    for (const entry of entries) {
      const room = roomById.get(entry.roomId)!;
      if (entry.adults + (entry.childrenAges?.length ?? 0) > room.maxOccupancy) {
        throw new BadRequestException(
          `Room ${room.name} has more guests than its maximum occupancy`,
        );
      }
    }

    // free the nights of expired holds first, then check the bookable ranges and blocks
    await this.expireHolds();
    const [covered, blocked] = await Promise.all([
      this.availabilityModel
        .distinct('roomId', {
          roomId: { $in: roomIds },
          startDate: { $lte: checkIn },
          endDate: { $gte: checkOut },
        })
        .exec(),
      this.blockModel
        .distinct('roomId', {
          roomId: { $in: roomIds },
          startDate: { $lt: checkOut },
          endDate: { $gt: checkIn },
        })
        .exec(),
    ]);
    const coveredSet = new Set(covered.map(String));
    const blockedSet = new Set(blocked.map(String));
    if (roomIds.some((id) => !coveredSet.has(id) || blockedSet.has(id))) {
      throw new ConflictException('One or more rooms are not available for these dates');
    }

    const nights = nightsOf(checkIn, checkOut);
    // price at booking time: nights x each room's current price
    const totalPrice = entries.reduce(
      (sum, e) => sum + roomById.get(e.roomId)!.pricePerNight * nights.length,
      0,
    );

    const session = await this.connection.startSession();
    try {
      let booking!: HotelBookingDocument;
      // all-or-nothing: the unique (room, night) lock rejects any overlap
      await session.withTransaction(async () => {
        const [created] = await this.bookingModel.create(
          [
            {
              userId,
              hotelId: dto.hotelId,
              rooms: entries.map((e) => ({
                roomId: e.roomId,
                adults: e.adults,
                childrenAges: e.childrenAges ?? [],
                pricePerNight: roomById.get(e.roomId)!.pricePerNight,
              })),
              checkIn,
              checkOut,
              totalPrice,
              currency: this.platformCurrency,
              status: BookingStatus.PENDING_PAYMENT,
              holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
              // PAY-02: what the user will accept, frozen at booking time
              policiesSnapshot: {
                cancellationTiers: hotel.cancellationTiers.map((t) => ({
                  daysBeforeDeparture: t.daysBefore,
                  refundPercentage: t.refundPercent,
                })),
                checkInTime: hotel.checkInTime,
                checkOutTime: hotel.checkOutTime,
              },
            },
          ],
          { session },
        );
        booking = created;
        await this.lockModel.insertMany(
          entries.flatMap((e) =>
            nights.map((night) => ({
              roomId: e.roomId,
              night,
              bookingId: created._id,
            })),
          ),
          { session },
        );
      });
      return booking;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        throw new ConflictException(
          'One or more rooms are already reserved for these dates',
        );
      }
      throw e;
    } finally {
      await session.endSession();
    }
  }
}

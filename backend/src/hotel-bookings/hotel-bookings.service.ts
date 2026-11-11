import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { BookingStatus } from '../common/enums/booking-status.enum';
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
} from './schemas/hotel-booking.schema';
import {
  RoomNightLock,
  RoomNightLockDocument,
} from './schemas/room-night-lock.schema';

const HOLD_MINUTES = 10;
const EXPIRY_CHECK_MS = 60_000;

@Injectable()
export class HotelBookingsService implements OnModuleInit, OnModuleDestroy {
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
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.expireHolds().catch((e: unknown) =>
        this.logger.error('Could not expire holds', e),
      );
    }, EXPIRY_CHECK_MS);
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
    if (!expired.length) return;
    const ids = expired.map((b) => b._id);
    await this.bookingModel.updateMany(
      { _id: { $in: ids } },
      { status: BookingStatus.EXPIRED },
    );
    await this.lockModel.deleteMany({ bookingId: { $in: ids } });
  }

  // HTL-17, written by Member 4. Member 5 (payments): call this from your payment
  // code once Stripe has verified a hotel payment (HotelBookingsModule exports this
  // service). It sets the reservation to Confirmed, generates the booking reference
  // and notifies the user. It throws a 409 if the reservation is not Pending Payment
  // or its 10-minute hold has expired. If a payment fails or expires, do nothing:
  // the expiry timer below releases the rooms.
  async confirm(bookingId: string) {
    // shortcut: a random 10-hex reference, a clash is rejected by the unique index, not retried
    const reference = `HTL-${randomBytes(5).toString('hex').toUpperCase()}`;
    const booking = await this.bookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { $gt: new Date() },
      },
      { status: BookingStatus.CONFIRMED, reference },
      { returnDocument: 'after' },
    );
    if (!booking) {
      throw new ConflictException(
        'This reservation is not awaiting payment, or its hold has expired',
      );
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
    return booking;
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
              status: BookingStatus.PENDING_PAYMENT,
              holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
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

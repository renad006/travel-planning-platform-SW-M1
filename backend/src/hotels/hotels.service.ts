import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { Hotel, HotelDocument } from './schemas/hotel.schema';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room, RoomDocument } from './schemas/room.schema';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { RoomAvailability, RoomAvailabilityDocument, } from './schemas/room-availability.schema';
import { UpdateRoomDto } from './dto/update-room.dto';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { HotelBooking, HotelBookingDocument, } from '../hotel-bookings/schemas/hotel-booking.schema';
import { RoomBlock, RoomBlockDocument } from './schemas/room-block.schema';
import { RoomStatusQueryDto } from './dto/room-status-query.dto';
import { SearchHotelsQueryDto } from './dto/search-hotels-query.dto';
import { RoomsAvailableQueryDto } from './dto/rooms-available-query.dto';
import { HotelDetailsQueryDto } from './dto/hotel-details-query.dto';
import {
    buildPaginatedResponse,
    getSkip,
} from '../common/utils/pagination.helper';
@Injectable()
export class HotelsService {
    constructor(
        @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
        @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
        @InjectModel(RoomAvailability.name) private readonly availabilityModel: Model<RoomAvailabilityDocument>,
        @InjectModel(RoomBlock.name) private readonly blockModel: Model<RoomBlockDocument>,
        @InjectModel(HotelBooking.name)private readonly bookingModel: Model<HotelBookingDocument>,
    ) {}

    create(dto: CreateHotelDto) {
        return this.hotelModel.create(dto);
    }
    
    findById(id: string) {
        return this.hotelModel.findById(id).exec();
    }

    update(id: string, dto: UpdateHotelDto) {
        return this.hotelModel
            .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
            .exec();
    }

    async createRoom(hotelId: string, dto: CreateRoomDto) {
        if (!(await this.findById(hotelId))) {
            throw new NotFoundException('Hotel not found');
        }
        try {
            return await this.roomModel.create({ ...dto, hotelId });
        } catch (e) {
        // 11000 = duplicate key: same room name in the same hotel
        if ((e as { code?: number }).code === 11000) {
            throw new ConflictException(
                'A room with this name already exists in this hotel',
            );
        }
        throw e;
        }
    }

    async addAvailability(
        hotelId: string,
        roomId: string,
        dto: CreateAvailabilityDto,
    ) {
        const room = await this.roomModel.findOne({ _id: roomId, hotelId }).exec();
            if (!room) {
                throw new NotFoundException('Room not found in this hotel');
            }
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);
        if (endDate <= startDate) {
            throw new BadRequestException('End date must be after start date');
        }
        // Two ranges overlap when each starts before the other ends
        const overlap = await this.availabilityModel.exists({
            roomId,
            startDate: { $lt: endDate },
            endDate: { $gt: startDate },
        });
        if (overlap) {
            throw new ConflictException(
                'This range overlaps an existing availability range',
            );
        }
        return this.availabilityModel.create({ roomId, startDate, endDate });
    }

    async updateRoom(hotelId: string, roomId: string, dto: UpdateRoomDto) {
        const room = await this.roomModel
            .findOneAndUpdate({ _id: roomId, hotelId }, dto, {
                returnDocument: 'after',
            })
            .exec();
        if (!room) {
            throw new NotFoundException('Room not found in this hotel');
        }
        return room;
    }

    async blockRoom(
        hotelId: string,
        roomId: string,
        dto: CreateAvailabilityDto,
    ) {
        const room = await this.roomModel.findOne({ _id: roomId, hotelId }).exec();
        if (!room) {
            throw new NotFoundException('Room not found in this hotel');
        }
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);
        if (endDate <= startDate) {
            throw new BadRequestException('End date must be after start date');
        }
        // HTL-06: refuse if a Confirmed or Pending Payment reservation overlaps
        const clash = await this.bookingModel.exists({
            'rooms.roomId': room._id,
            status: {
                $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT],
            },
                checkIn: { $lt: endDate },
                checkOut: { $gt: startDate },
            });
            if (clash) {
                throw new ConflictException(
                    'This range overlaps an existing reservation',
                );
        }
        return this.blockModel.create({ roomId, startDate, endDate });
    }

    async deactivateRoom(hotelId: string, roomId: string) {
        const room = await this.roomModel.findOne({ _id: roomId, hotelId }).exec();
        if (!room) {
            throw new NotFoundException('Room not found in this hotel');
        }
        // HTL-06: refuse if a Confirmed or Pending Payment reservation is not over yet
        const clash = await this.bookingModel.exists({
            'rooms.roomId': room._id,
            status: {
                $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT],
            },
            checkOut: { $gt: new Date() },
        });
        if (clash) {
            throw new ConflictException(
                'This room has current or upcoming reservations',
            );
        }
        room.isActive = false;
        return room.save();
    }

    async deleteRoom(hotelId: string, roomId: string) {
        const room = await this.roomModel.findOne({ _id: roomId, hotelId }).exec();
        if (!room) {
            throw new NotFoundException('Room not found in this hotel');
        }
        // HTL-06: only rooms that were never reserved can be deleted
        if (await this.bookingModel.exists({ 'rooms.roomId': room._id })) {
            throw new ConflictException(
                'This room has been reserved before, deactivate it instead',
            );
        }
        await this.availabilityModel.deleteMany({ roomId: room._id });
        await this.blockModel.deleteMany({ roomId: room._id });
        await room.deleteOne();
    }

    async roomStatuses(hotelId: string, query: RoomStatusQueryDto) {
        const from = new Date(query.from);
        const to = new Date(query.to);
        if (to <= from) {
            throw new BadRequestException('"to" must be after "from"');
        }
        const rooms = await this.roomModel.find({ hotelId }).exec();
        // shortcut: three queries per room, fine for a hotel's room count
        return Promise.all(
            rooms.map(async (room) => {
                const booking = await this.bookingModel
                    .findOne({
                        'rooms.roomId': room._id,
                        status: {
                            $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT],
                        },
                        checkIn: { $lt: to },
                        checkOut: { $gt: from },
                    })
                .exec();
                if (booking) {
                    return {
                        roomId: room.id as string,
                        name: room.name,
                        status: 'Booked',
                        reference: booking.reference ?? null,
                    };
                }
                const blocked = await this.blockModel.exists({
                    roomId: room._id,
                    startDate: { $lt: to },
                    endDate: { $gt: from },
                });
                // a room with no availability range covering the dates cannot be booked
                const covered = await this.availabilityModel.exists({
                    roomId: room._id,
                    startDate: { $lte: from },
                    endDate: { $gte: to },
                });
                return {
                    roomId: room.id as string,
                    name: room.name,
                    status: blocked || !covered ? 'Blocked' : 'Available',
                };
            }),
        );
    }

    // HTL-11 / HTL-15: check-out after check-in, and check-in not in the past
    private parseStay(checkInText: string, checkOutText: string) {
        const checkIn = new Date(checkInText);
        const checkOut = new Date(checkOutText);
        if (checkOut <= checkIn) {
            throw new BadRequestException('Check-out must be after check-in');
        }
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (checkIn < today) {
            throw new BadRequestException('Check-in cannot be in the past');
        }
        return { checkIn, checkOut };
    }

    // Rooms that are bookable, not blocked and not reserved for the whole stay
    private async freeRooms(rooms: RoomDocument[], checkIn: Date, checkOut: Date) {
        const roomIds = rooms.map((r) => r._id);
        // shortcut: one bookable range must cover the whole stay, adjacent ranges are not joined
        const [covered, blocked, booked] = await Promise.all([
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
            this.bookingModel
                .distinct('rooms.roomId', {
                    'rooms.roomId': { $in: roomIds },
                    status: {
                        $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT],
                    },
                    checkIn: { $lt: checkOut },
                    checkOut: { $gt: checkIn },
                })
                .exec(),
        ]);
        const coveredSet = new Set(covered.map(String));
        const unavailable = new Set([...blocked, ...booked].map(String));
        return rooms.filter(
            (r) => coveredSet.has(r.id as string) && !unavailable.has(r.id as string),
        );
    }

    async details(id: string, query: HotelDetailsQueryDto) {
        if (!query.checkIn !== !query.checkOut) {
            throw new BadRequestException('Provide both checkIn and checkOut');
        }
        const hotel = await this.hotelModel.findOne({ _id: id, isActive: true });
        if (!hotel) {
            throw new NotFoundException('Hotel not found');
        }
        if (!query.checkIn || !query.checkOut) {
            return hotel.toJSON();
        }
        const availableRooms = await this.availableRooms(id, {
            checkIn: query.checkIn,
            checkOut: query.checkOut,
        });
        return { ...hotel.toJSON(), availableRooms };
    }

    async availableRooms(hotelId: string, query: RoomsAvailableQueryDto) {
        const { checkIn, checkOut } = this.parseStay(query.checkIn, query.checkOut);
        const hotel = await this.hotelModel.findOne({ _id: hotelId, isActive: true });
        if (!hotel) {
            throw new NotFoundException('Hotel not found');
        }
        const rooms = await this.roomModel
            .find({ hotelId, isActive: true })
            .sort({ pricePerNight: 1 })
            .exec();
        const nights = Math.round(
            (checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000),
        );
        return (await this.freeRooms(rooms, checkIn, checkOut)).map((room) => ({
            ...room.toJSON(),
            nights,
            totalPrice: room.pricePerNight * nights,
        }));
    }

    async search(query: SearchHotelsQueryDto) {
        if (!query.cityId && !query.countryCode) {
            throw new BadRequestException('Provide a cityId or a countryCode');
        }
        const { checkIn, checkOut } = this.parseStay(query.checkIn, query.checkOut);

        const hotels = await this.hotelModel
            .find({
                isActive: true,
                ...(query.cityId && { cityId: query.cityId }),
                ...(query.countryCode && {
                    countryCode: query.countryCode.toUpperCase(),
                }),
            })
            .sort({ name: 1 })
            .exec();
        const rooms = await this.roomModel
            .find({ hotelId: { $in: hotels.map((h) => h._id) }, isActive: true })
            .exec();
        const freeByHotel = new Map<string, RoomDocument[]>();
        for (const room of await this.freeRooms(rooms, checkIn, checkOut)) {
            const key = room.hotelId.toString();
            freeByHotel.set(key, [...(freeByHotel.get(key) ?? []), room]);
        }

        // enough free rooms, and the largest ones together fit all the guests
        const matching = hotels
            .map((hotel) => {
                const free = freeByHotel.get(hotel.id as string) ?? [];
                const capacity = free
                    .map((r) => r.maxOccupancy)
                    .sort((a, b) => b - a)
                    .slice(0, query.rooms)
                    .reduce((sum, n) => sum + n, 0);
                const fits = free.length >= query.rooms && capacity >= query.guests;
                // HTL-12: the hotel's price is its cheapest free room per night
                const cheapestPrice = Math.min(...free.map((r) => r.pricePerNight));
                return { hotel, fits, cheapestPrice };
            })
            .filter(
                ({ hotel, fits, cheapestPrice }) =>
                    fits &&
                    (query.minPrice === undefined || cheapestPrice >= query.minPrice) &&
                    (query.maxPrice === undefined || cheapestPrice <= query.maxPrice) &&
                    // unrated hotels (avgRating null) are excluded by a rating filter
                    (query.minRating === undefined ||
                        (hotel.avgRating !== null &&
                            hotel.avgRating >= query.minRating)),
            );

        const direction = query.sortOrder === 'asc' ? 1 : -1;
        if (query.sortBy === 'price') {
            matching.sort((a, b) => (a.cheapestPrice - b.cheapestPrice) * direction);
        } else if (query.sortBy === 'rating') {
            // unrated hotels sort as 0, so they come last when highest rating is first
            matching.sort(
                (a, b) =>
                    ((a.hotel.avgRating ?? 0) - (b.hotel.avgRating ?? 0)) *
                    direction,
            );
        }

        const items = matching
            .slice(getSkip(query), getSkip(query) + query.limit)
            .map(({ hotel, cheapestPrice }) => ({ ...hotel.toJSON(), cheapestPrice }));
        return buildPaginatedResponse(items, matching.length, query);
    }
}
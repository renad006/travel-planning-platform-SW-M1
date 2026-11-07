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
@Injectable()
export class HotelsService {
    constructor(
        @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
        @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
        @InjectModel(RoomAvailability.name) private readonly availabilityModel: Model<RoomAvailabilityDocument>,
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
}
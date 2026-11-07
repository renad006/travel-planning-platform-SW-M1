import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { Hotel, HotelDocument } from './schemas/hotel.schema';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room, RoomDocument } from './schemas/room.schema';

@Injectable()
export class HotelsService {
    constructor(
        @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
        @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
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
}
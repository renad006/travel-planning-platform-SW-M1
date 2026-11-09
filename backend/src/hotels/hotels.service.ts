import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { Hotel, HotelDocument } from './schemas/hotel.schema';
import { UpdateHotelDto } from './dto/update-hotel.dto';

@Injectable()
export class HotelsService {
    constructor(
        @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
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
}
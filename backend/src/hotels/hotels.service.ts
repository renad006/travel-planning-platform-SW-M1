import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { Hotel, HotelDocument } from './schemas/hotel.schema';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { UpdatePoliciesDto } from './dto/update-policies.dto';

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

    async setPolicies(id: string, dto: UpdatePoliciesDto) {
        const thresholds = dto.cancellationTiers.map((t) => t.daysBefore);
        if (new Set(thresholds).size !== thresholds.length) {
            throw new BadRequestException(
                'Each cancellation tier needs a unique days-before threshold',
            );
        }
        const hotel = await this.hotelModel
            .findByIdAndUpdate(
                id,
                { cancellationTiers: dto.cancellationTiers },
                { returnDocument: 'after' },
            )
            .exec();
        if (!hotel) {
            throw new NotFoundException('Hotel not found');
        }
        return hotel;
    }
}
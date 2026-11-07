import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hotel, HotelSchema } from './schemas/hotel.schema';

@Module({
    imports: [MongooseModule.forFeature([{ name: Hotel.name, schema: HotelSchema }])],
})
export class HotelsModule {}
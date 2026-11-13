import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
    HotelBooking,
    HotelBookingSchema,
} from './schemas/hotel-booking.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
        { name: HotelBooking.name, schema: HotelBookingSchema },
        ]),
    ],
})
export class HotelBookingsModule {}
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hotel, HotelSchema } from './schemas/hotel.schema';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { Room, RoomSchema } from './schemas/room.schema';
import { RoomAvailability, RoomAvailabilitySchema, } from './schemas/room-availability.schema';
import { RoomBlock, RoomBlockSchema } from './schemas/room-block.schema';
import { HotelBooking, HotelBookingSchema, } from '../hotel-bookings/schemas/hotel-booking.schema';

@Module({
    imports: [MongooseModule.forFeature([
        { name: Hotel.name, schema: HotelSchema },
        { name: Room.name, schema: RoomSchema },
        { name: RoomAvailability.name, schema: RoomAvailabilitySchema },
        { name: RoomBlock.name, schema: RoomBlockSchema },
        { name: HotelBooking.name, schema: HotelBookingSchema },
    ])],
    controllers: [HotelsController],
    providers: [HotelsService],
})
export class HotelsModule {}
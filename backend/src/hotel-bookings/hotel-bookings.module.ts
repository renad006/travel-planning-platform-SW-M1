import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hotel, HotelSchema } from '../hotels/schemas/hotel.schema';
import { Room, RoomSchema } from '../hotels/schemas/room.schema';
import {
    RoomAvailability,
    RoomAvailabilitySchema,
} from '../hotels/schemas/room-availability.schema';
import { RoomBlock, RoomBlockSchema } from '../hotels/schemas/room-block.schema';
import { HotelBookingsController } from './hotel-bookings.controller';
import { HotelBookingsService } from './hotel-bookings.service';
import {
    HotelBooking,
    HotelBookingSchema,
} from './schemas/hotel-booking.schema';
import {
    RoomNightLock,
    RoomNightLockSchema,
} from './schemas/room-night-lock.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: HotelBooking.name, schema: HotelBookingSchema },
            { name: RoomNightLock.name, schema: RoomNightLockSchema },
            { name: Hotel.name, schema: HotelSchema },
            { name: Room.name, schema: RoomSchema },
            { name: RoomAvailability.name, schema: RoomAvailabilitySchema },
            { name: RoomBlock.name, schema: RoomBlockSchema },
        ]),
    ],
    controllers: [HotelBookingsController],
    providers: [HotelBookingsService],
    exports: [HotelBookingsService],
})
export class HotelBookingsModule {}

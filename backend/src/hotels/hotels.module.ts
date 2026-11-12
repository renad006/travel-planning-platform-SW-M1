import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hotel, HotelSchema } from './schemas/hotel.schema';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { Room, RoomSchema } from './schemas/room.schema';

@Module({
    imports: [MongooseModule.forFeature([{ name: Hotel.name, schema: HotelSchema }, { name: Room.name, schema: RoomSchema },])],
    controllers: [HotelsController],
    providers: [HotelsService],
})
export class HotelsModule {}
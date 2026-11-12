import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Hotel } from './hotel.schema';

export type RoomDocument = HydratedDocument<Room>;

// HTL-03: an individually bookable unit that belongs to one hotel
@Schema({ timestamps: true })
export class Room {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Hotel.name,
        required: true,
        index: true,
    })
    hotelId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, trim: true })
    type: string;

    @Prop({ required: true, min: 1 })
    beds: number;

    @Prop({ required: true, min: 1 })
    maxOccupancy: number;

    @Prop({
        required: true,
        validate: [(v: number) => v > 0, 'Price per night must be greater than 0'],
    })
    pricePerNight: number;

  // HTL-06: deactivated rooms are excluded from search
    @Prop({ default: true })
    isActive: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// HTL-03: room name is unique within its hotel
RoomSchema.index({ hotelId: 1, name: 1 }, { unique: true });
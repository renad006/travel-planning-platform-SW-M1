import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Room } from './room.schema';

export type RoomAvailabilityDocument = HydratedDocument<RoomAvailability>;

// HTL-04: a date range when a room is bookable. endDate is the checkout day.
@Schema({ timestamps: true })
export class RoomAvailability {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Room.name,
        required: true,
        index: true,
    })
    roomId: Types.ObjectId;

    @Prop({ required: true })
    startDate: Date;

    @Prop({
        required: true,
        validate: [
        function (this: RoomAvailability, v: Date) {
            return v > this.startDate;
        },
        'End date must be after start date',
        ],
    })
    endDate: Date;
}

export const RoomAvailabilitySchema =
    SchemaFactory.createForClass(RoomAvailability);
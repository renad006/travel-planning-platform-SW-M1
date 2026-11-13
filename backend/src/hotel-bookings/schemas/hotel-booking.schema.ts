import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Hotel } from '../../hotels/schemas/hotel.schema';
import { Room } from '../../hotels/schemas/room.schema';
import { User } from '../../users/schemas/user.schema';

export type HotelBookingDocument = HydratedDocument<HotelBooking>;

export interface BookedRoom {
    roomId: Types.ObjectId;
    adults: number;
    childrenAges: number[];
    pricePerNight: number;
}

// HTL-16 to HTL-21: one reservation can hold several rooms of the same hotel
@Schema({ timestamps: true })
export class HotelBooking {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: true,
        index: true,
    })
    userId: Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Hotel.name,
        required: true,
        index: true,
    })
    hotelId: Types.ObjectId;

    @Prop({
        type: [
        {
            _id: false,
            roomId: {
            type: MongooseSchema.Types.ObjectId,
            ref: Room.name,
            required: true,
            },
            adults: { type: Number, required: true, min: 0 },
            childrenAges: { type: [{ type: Number, min: 0, max: 17 }], default: [] },
            // price at booking time, so later price changes do not affect it
            pricePerNight: { type: Number, required: true },
        },
        ],
        required: true,
    })
    rooms: BookedRoom[];

    @Prop({ required: true })
    checkIn: Date;

    // checkout day, same rule as room availability
    @Prop({ required: true })
    checkOut: Date;

    @Prop({ required: true })
    totalPrice: number;

    @Prop({
        type: String,
        enum: BookingStatus,
        default: BookingStatus.PENDING_PAYMENT,
    })
    status: BookingStatus;

    // HTL-18: the hold ends 10 minutes after the booking starts
    @Prop()
    holdExpiresAt?: Date;

    // HTL-17: set after successful payment
    @Prop({ unique: true, sparse: true })
    reference?: string;
}

export const HotelBookingSchema = SchemaFactory.createForClass(HotelBooking);
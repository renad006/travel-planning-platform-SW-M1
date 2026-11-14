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

// Who cancelled: the user (HTL-21) or the hotel (always a 100% refund)
export enum HotelCancelledBy {
    USER = 'user',
    HOTEL = 'hotel',
}

// Copy of the hotel policies at booking time: what the user accepted (PAY-02).
// Same tier shape as the flight booking snapshot.
export interface HotelPolicySnapshot {
    cancellationTiers: { daysBeforeDeparture: number; refundPercentage: number }[];
    checkInTime?: string;
    checkOutTime?: string;
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

    // PAY-04: one platform currency, same default as flight bookings
    @Prop({ type: String, default: 'USD', uppercase: true, trim: true })
    currency: string;

    // set by confirmAfterPayment when the payment succeeds
    @Prop()
    confirmedAt?: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment' })
    paymentId?: Types.ObjectId;

    // PAY-02: the policies shown to the user, and when they accepted them
    @Prop({
        type: {
            _id: false,
            cancellationTiers: {
                type: [
                    {
                        _id: false,
                        daysBeforeDeparture: { type: Number, required: true, min: 0 },
                        refundPercentage: { type: Number, required: true, min: 0, max: 100 },
                    },
                ],
                default: [],
            },
            checkInTime: String,
            checkOutTime: String,
        },
    })
    policiesSnapshot?: HotelPolicySnapshot;

    @Prop()
    policiesAcceptedAt?: Date;

    // cancellation and refund (HTL-21, PAY-03). The refund itself lives in Member 5's Refund.
    @Prop()
    cancelledAt?: Date;

    @Prop({ type: String, enum: Object.values(HotelCancelledBy) })
    cancelledBy?: HotelCancelledBy;

    @Prop({ min: 0, max: 100 })
    refundPercentage?: number;

    @Prop({ min: 0 })
    refundAmount?: number;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Refund' })
    refundId?: Types.ObjectId;
}

export const HotelBookingSchema = SchemaFactory.createForClass(HotelBooking);
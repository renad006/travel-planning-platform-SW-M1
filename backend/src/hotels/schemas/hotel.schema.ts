import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HotelDocument = HydratedDocument<Hotel>;

@Schema({ timestamps: true })
export class Hotel {
    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, trim: true })
    address: string;

    @Prop({ required: true, trim: true, index: true })
    cityId: string;

    @Prop({ required: true, uppercase: true, trim: true })
    countryCode: string;

    @Prop({ trim: true })
    description?: string;

    // GEN-08: at most 5 images per hotel
    @Prop({
        type: [String],
        default: [],
        validate: [(v: string[]) => v.length <= 5, 'A hotel can have at most 5 photos'],
    })
    photos: string[];

    @Prop({ min: 1, max: 5 })
    starClass?: number;

    @Prop({ type: [String], default: [] })
    amenities: string[];

    // HTL-09: standard times as 24-hour HH:mm, set by the hotel moderator
    @Prop({ match: /^([01]\d|2[0-3]):[0-5]\d$/ })
    checkInTime?: string;

    @Prop({ match: /^([01]\d|2[0-3]):[0-5]\d$/ })
    checkOutTime?: string;

    // ACC-15: inactive hotels are hidden from search and cannot be booked
    @Prop({ default: true })
    isActive: boolean;

    // HTL-12 / HTL-23: average review rating, named by Member 4.
    // Member 5 (HTL-23): recalculate and save both fields whenever a review
    // is created, edited or deleted. avgRating stays empty until the first review.
    @Prop({ type: Number, min: 1, max: 5, default: null })
    avgRating: number | null;

    @Prop({ default: 0 })
    ratingCount: number;

    // HTL-10: refund tiers, applied like FLT-09
    @Prop({
        type: [
        {
            _id: false,
            daysBefore: { type: Number, required: true, min: 0 },
            refundPercent: { type: Number, required: true, min: 0, max: 100 },
        },
        ],
        default: [],
    })
    cancellationTiers: { daysBefore: number; refundPercent: number }[];
}

export const HotelSchema = SchemaFactory.createForClass(Hotel);
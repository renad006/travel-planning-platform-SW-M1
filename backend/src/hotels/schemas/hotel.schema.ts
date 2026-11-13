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
}

export const HotelSchema = SchemaFactory.createForClass(Hotel);
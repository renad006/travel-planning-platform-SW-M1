import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavouriteDocument = HydratedDocument<Favourite>;

export const FAVOURITE_TYPES = ['hotel', 'itinerary'] as const;
export type FavouriteType = (typeof FAVOURITE_TYPES)[number];

// BON-02: a hotel or a public itinerary saved by a user
@Schema({ timestamps: true })
export class Favourite {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: String, enum: FAVOURITE_TYPES, required: true })
    type: FavouriteType;

    // a Hotel or an Itinerary id, depending on type
    @Prop({ type: Types.ObjectId, required: true })
    targetId: Types.ObjectId;
}

export const FavouriteSchema = SchemaFactory.createForClass(Favourite);
// the same hotel or itinerary can only be saved once per user
FavouriteSchema.index({ userId: 1, type: 1, targetId: 1 }, { unique: true });

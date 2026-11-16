import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { HotelBooking } from '../../hotel-bookings/schemas/hotel-booking.schema';
import { Hotel } from '../../hotels/schemas/hotel.schema';
import { User } from '../../users/schemas/user.schema';

export type ReviewDocument = HydratedDocument<Review>;

// HTL-23: one review per Completed reservation, regardless of how many rooms it covers
@Schema({ timestamps: true })
export class Review {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: HotelBooking.name,
    required: true,
    unique: true,
    index: true,
  })
  bookingId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Hotel.name,
    required: true,
    index: true,
  })
  hotelId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  text?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Room } from '../../hotels/schemas/room.schema';
import { HotelBooking } from './hotel-booking.schema';

export type RoomNightLockDocument = HydratedDocument<RoomNightLock>;

// HTL-18: one record per room per night of a Pending Payment or Confirmed
// reservation. The unique index below makes a double booking impossible.
@Schema({ timestamps: true })
export class RoomNightLock {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Room.name,
    required: true,
  })
  roomId: Types.ObjectId;

  // the night starting at this UTC date
  @Prop({ required: true })
  night: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: HotelBooking.name,
    required: true,
    index: true,
  })
  bookingId: Types.ObjectId;
}

export const RoomNightLockSchema = SchemaFactory.createForClass(RoomNightLock);

RoomNightLockSchema.index({ roomId: 1, night: 1 }, { unique: true });

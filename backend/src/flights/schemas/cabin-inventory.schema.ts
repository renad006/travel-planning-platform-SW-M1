import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CabinInventoryDocument = HydratedDocument<CabinInventory>;

/** FLT-04: the fixed set of cabin categories. */
export enum CabinClass {
  ECONOMY = 'Economy',
  PREMIUM_ECONOMY = 'Premium Economy',
  BUSINESS = 'Business',
  FIRST = 'First',
}

@Schema({ timestamps: true })
export class CabinInventory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Flight', required: true })
  flightId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(CabinClass), required: true })
  cabinClass: CabinClass;

  @Prop({ required: true, min: 1 })
  totalSeats: number;

  /** Seats reserved by Pending Payment bookings (FLT-22). */
  @Prop({ required: true, default: 0, min: 0 })
  heldSeats: number;

  /** Seats of Confirmed bookings (FLT-23). */
  @Prop({ required: true, default: 0, min: 0 })
  bookedSeats: number;

  /** Fare per adult/child, in the single platform currency (PAY-04). */
  @Prop({ required: true, min: 0.01 })
  price: number;

  /** FLT-04: free baggage allowance (number of bags). */
  @Prop({ required: true, min: 0 })
  freeBags: number;

  /** FLT-04: maximum weight per bag (kg). */
  @Prop({ required: true, min: 0.1 })
  maxWeightKg: number;
}

export const CabinInventorySchema = SchemaFactory.createForClass(CabinInventory);

// FLT-04: each cabin category is used at most once per flight.
CabinInventorySchema.index({ flightId: 1, cabinClass: 1 }, { unique: true });

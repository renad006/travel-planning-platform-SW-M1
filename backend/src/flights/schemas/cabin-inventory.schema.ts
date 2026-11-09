import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CabinInventoryDocument = HydratedDocument<CabinInventory>;

@Schema({ timestamps: true })
export class CabinInventory {
  @Prop({ type: Types.ObjectId, ref: 'Flight', required: true })
  flightId: Types.ObjectId;

  @Prop({ required: true, enum: ['Economy', 'Business'] })
  cabinClass: string;

  @Prop({ required: true })
  totalSeats: number;

  @Prop({ required: true, default: 0 })
  heldSeats: number; // Seats currently in checkout

  @Prop({ required: true })
  bookedSeats: number; // Seats confirmed

  @Prop({ required: true })
  price: number;
}

export const CabinInventorySchema = SchemaFactory.createForClass(CabinInventory);

// Ensure one inventory doc per flight + cabin class
CabinInventorySchema.index({ flightId: 1, cabinClass: 1 }, { unique: true });
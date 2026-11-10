import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirlineDocument = HydratedDocument<Airline>;

@Schema({ timestamps: true })
export class Airline {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true })
  iataCode: string;

  @Prop({ default: true })
  isActive: boolean; // FLT-01: default true

  // FLT-04, FLT-08: Baggage Policy
  @Prop({ type: Object, default: { cabin: '7kg', checked: '23kg' } })
  baggagePolicy: {
    cabin: string;
    checked: string;
  };

  // FLT-09: Cancellation Policy
  @Prop({ type: [Object], default: [] })
  cancellationPolicy: Array<{
    hoursBeforeDeparture: number;
    refundPercentage: number;
  }>;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);
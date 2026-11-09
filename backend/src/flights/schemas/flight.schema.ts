import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FlightDocument = HydratedDocument<Flight>;

export enum FlightStatus {
  SCHEDULED = 'Scheduled',
  CANCELLED = 'Cancelled',
  DEPARTED = 'Departed',
}

@Schema({ timestamps: true })
export class Flight {
  @Prop({ required: true })
  flightNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Airline', required: true })
  airlineId: Types.ObjectId;

  @Prop({ required: true })
  originAirport: string; // IATA code

  @Prop({ required: true })
  destinationAirport: string; // IATA code

  // FLT-03, FLT-17: Times stored in UTC
  @Prop({ required: true })
  departureTime: Date;

  @Prop({ required: true })
  arrivalTime: Date;

  @Prop({ type: String, enum: FlightStatus, default: FlightStatus.SCHEDULED })
  status: FlightStatus;
}

export const FlightSchema = SchemaFactory.createForClass(Flight);
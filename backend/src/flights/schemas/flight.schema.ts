import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type FlightDocument = HydratedDocument<Flight>;

/** FLT-30 */
export enum FlightStatus {
  SCHEDULED = 'Scheduled',
  CANCELLED = 'Cancelled',
  DEPARTED = 'Departed',
}

@Schema({ timestamps: true })
export class Flight {
  @Prop({ required: true, trim: true, uppercase: true })
  flightNumber: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Airline', required: true })
  airlineId: Types.ObjectId;

  /**
   * FLT-02: IATA code of a seeded Airport (Member 1's reference data).
   * Linked to the Airport collection through the `originAirportRef` virtual below.
   */
  @Prop({ required: true, uppercase: true })
  originAirport: string;

  /** FLT-02: IATA code of a seeded Airport (see `destinationAirportRef`). */
  @Prop({ required: true, uppercase: true })
  destinationAirport: string;

  /** FLT-03: always stored in UTC. */
  @Prop({ required: true })
  departureTime: Date;

  @Prop({ required: true })
  arrivalTime: Date;

  /**
   * 'YYYY-MM-DD' of the departure in the ORIGIN airport's time zone.
   * Used by search (FLT-11: "local date at the departure airport")
   * and by the duplicate-flight rule (FLT-03). Recomputed on every schedule edit.
   */
  @Prop({ required: true })
  departureLocalDate: string;

  @Prop({ type: String, enum: Object.values(FlightStatus), default: FlightStatus.SCHEDULED })
  status: FlightStatus;

  /**
   * FLT-05: set (never cleared) the first time seats are reserved, so airports stay locked
   * even if every booking is later cancelled or expires.
   */
  @Prop({ type: Boolean, default: false })
  hasBookings: boolean;
}

export const FlightSchema = SchemaFactory.createForClass(Flight);

// Reference to Member 1's Airport schema (joined on the IATA code).
// Usage: flightModel.find().populate('originAirportRef destinationAirportRef')
FlightSchema.virtual('originAirportRef', {
  ref: 'Airport',
  localField: 'originAirport',
  foreignField: 'iataCode',
  justOne: true,
});
FlightSchema.virtual('destinationAirportRef', {
  ref: 'Airport',
  localField: 'destinationAirport',
  foreignField: 'iataCode',
  justOne: true,
});

// FLT-03: no duplicate flight number for the same airline on the same departure date
FlightSchema.index({ airlineId: 1, flightNumber: 1, departureLocalDate: 1 }, { unique: true });
// search (FLT-11)
FlightSchema.index({ status: 1, originAirport: 1, destinationAirport: 1, departureLocalDate: 1 });
// "Departed" cron (FLT-30)
FlightSchema.index({ status: 1, departureTime: 1 });

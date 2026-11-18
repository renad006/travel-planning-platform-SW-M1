import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SeatAssignmentDocument = HydratedDocument<SeatAssignment>;

/**
 * FLT-28: one passenger's seat on one flight. A separate collection so that the database itself
 * guarantees a seat is given to ONE passenger only (unique index), even when two users pick the
 * same seat at the same moment.
 */
@Schema({ timestamps: true })
export class SeatAssignment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'FlightBooking', required: true })
  bookingId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Flight', required: true })
  flightId: Types.ObjectId;

  @Prop({ type: String, required: true })
  cabinClass: string;

  /** Position of the passenger in booking.passengers. */
  @Prop({ type: Number, required: true, min: 0 })
  passengerIndex: number;

  /** For example "30C". */
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  seat: string;

  /** How many times the passenger picked a seat (at most 3). Automatic seats count 0. */
  @Prop({ type: Number, required: true, default: 1, min: 0 })
  pickCount: number;

  /** Chosen by the user, or assigned by the system 24 hours before departure. */
  @Prop({ type: String, enum: ['chosen', 'auto'], default: 'chosen' })
  source: 'chosen' | 'auto';
}

export const SeatAssignmentSchema = SchemaFactory.createForClass(SeatAssignment);

// a seat of a flight cabin belongs to one passenger only
SeatAssignmentSchema.index({ flightId: 1, cabinClass: 1, seat: 1 }, { unique: true });
// a passenger has one seat per flight
SeatAssignmentSchema.index({ bookingId: 1, flightId: 1, passengerIndex: 1 }, { unique: true });

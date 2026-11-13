import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { CabinClass } from '../../flights/schemas/cabin-inventory.schema';
import { CancelledBy, PassengerType, SegmentDirection, TripType } from './flight-booking.enums';

// re-exported so existing imports from this file keep working
export { CancelledBy, PassengerType, SegmentDirection, TripType };

export type FlightBookingDocument = HydratedDocument<FlightBooking>;


/**
 * A booking has 1 segment (one-way) or 2 (round trip). Bounded and owned by the
 * booking, so it is embedded. Flight details are SNAPSHOTS so that the e-ticket
 * and the booking history stay correct even if the flight is edited later.
 */
@Schema({ _id: false })
export class FlightSegment {
  @Prop({ type: String, enum: Object.values(SegmentDirection), required: true })
  direction: SegmentDirection;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Flight', required: true })
  flightId: Types.ObjectId;

  @Prop({ type: String, required: true, uppercase: true, trim: true })
  flightNumber: string;

  @Prop({ type: String, enum: Object.values(CabinClass), required: true })
  cabinClass: CabinClass;

  /** IATA codes (Airport.iataCode), snapshot. */
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  originAirport: string;

  @Prop({ type: String, required: true, uppercase: true, trim: true })
  destinationAirport: string;

  /** Always UTC (FLT-03). Convert to airport time zones only when displaying (GEN-06). */
  @Prop({ type: Date, required: true })
  departureTime: Date;

  @Prop({ type: Date, required: true })
  arrivalTime: Date;

  /** Cabin fare per adult/child AT BOOKING TIME. Later price changes never affect it (FLT-05). */
  @Prop({ type: Number, required: true, min: 0.01 })
  farePerSeat: number;

  /** Fare for this segment: (adults + children) x fare + infants x 10% x fare. */
  @Prop({ type: Number, required: true, min: 0 })
  fareSubtotal: number;
}
export const FlightSegmentSchema = SchemaFactory.createForClass(FlightSegment);



@Schema()
export class Passenger {
  /** Set by the SERVER from the date of birth, never trusted from the client (FLT-12b). */
  @Prop({ type: String, enum: Object.values(PassengerType), required: true })
  type: PassengerType;

  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 100 })
  fullName: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({ type: String, required: true, uppercase: true, trim: true, minlength: 4, maxlength: 20 })
  passportNumber: string;

  /** FLT-19: optional extra bags, up to the airline's maxExtraBags. */
  @Prop({ type: Number, default: 0, min: 0 })
  extraBags: number;

  /** FLT-19: total declared weight of the extra bags (kg), <= extraBags x cabin.maxWeightKg. */
  @Prop({ type: Number, default: 0, min: 0 })
  extraBagWeightKg: number;

  /** This passenger's share of the fare (infants pay 10%). */
  @Prop({ type: Number, required: true, min: 0 })
  fare: number;

  /** extraBags x airline.extraBagPrice, added to the booking total (FLT-19). */
  @Prop({ type: Number, default: 0, min: 0 })
  baggageFee: number;
}
export const PassengerSchema = SchemaFactory.createForClass(Passenger);



@Schema({ _id: false })
export class CancellationTierSnapshot {
  @Prop({ type: Number, required: true, min: 0 })
  daysBeforeDeparture: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  refundPercentage: number;
}
const CancellationTierSnapshotSchema = SchemaFactory.createForClass(CancellationTierSnapshot);

/** Copy of the airline policies at booking time = proof of exactly what the user accepted. */
@Schema({ _id: false })
export class PolicySnapshot {
  @Prop({ type: [CancellationTierSnapshotSchema], default: [] })
  cancellationTiers: CancellationTierSnapshot[];

  @Prop({ type: Number, default: 0, min: 0 })
  extraBagPrice: number;

  @Prop({ type: Number, default: 0, min: 0 })
  maxExtraBags: number;
}
const PolicySnapshotSchema = SchemaFactory.createForClass(PolicySnapshot);




@Schema({ timestamps: true })
export class FlightBooking {
  /**
   * FLT-23: generated ONLY when payment is confirmed, so Pending Payment / Expired
   * bookings have none. Uniqueness is enforced by a partial index below.
   */
  @Prop({ type: String, uppercase: true, trim: true })
  reference?: string;

  /** FLT-23: e-ticket number, generated together with the reference. */
  @Prop({ type: String, uppercase: true, trim: true })
  eTicketNumber?: string;

  /** Owner. Every read/cancel checks this (ACC-11). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  /** Denormalised so moderators (FLT-29) and admins (ACC-17) can filter by provider. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Airline', required: true })
  airlineId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TripType), required: true })
  tripType: TripType;

  @Prop({ type: [FlightSegmentSchema], required: true })
  segments: FlightSegment[];

  @Prop({ type: [PassengerSchema], required: true })
  passengers: Passenger[];

  /** Seats actually occupied = adults + children (infants take no seat). Used for hold/release. */
  @Prop({ type: Number, required: true, min: 1 })
  seatCount: number;

  // lifecycle (GEN-11) 

  @Prop({
    type: String,
    enum: Object.values(BookingStatus),
    default: BookingStatus.PENDING_PAYMENT,
  })
  status: BookingStatus;

  /** FLT-22: created + 10 minutes. After this the booking is Expired and seats are released. */
  @Prop({ type: Date })
  holdExpiresAt?: Date;

  @Prop({ type: Date })
  confirmedAt?: Date;

  @Prop({ type: Date })
  expiredAt?: Date;

  //  money (PAY-04: one platform currency) 

  @Prop({ type: String, default: 'USD', uppercase: true, trim: true })
  currency: string;

  @Prop({ type: Number, required: true, min: 0 })
  fareTotal: number;

  @Prop({ type: Number, default: 0, min: 0 })
  baggageTotal: number;

  /** fareTotal + baggageTotal. Computed by the server, never taken from the client. */
  @Prop({ type: Number, required: true, min: 0 })
  totalPrice: number;

  //  policies (PAY-02)

  @Prop({ type: PolicySnapshotSchema })
  policiesSnapshot?: PolicySnapshot;

  /** PAY-02: set when the user accepts the policies. Payment is blocked while empty. */
  @Prop({ type: Date })
  policiesAcceptedAt?: Date;

  // payment link 

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment' })
  paymentId?: Types.ObjectId;

  //  denormalised dates for fast list/cancel queries

  /** Departure of the OUTBOUND segment. FLT-26 cancellation tier and "before departure" rule use it. */
  @Prop({ type: Date, required: true })
  departureTime: Date;

  /** Arrival of the LAST segment. Upcoming = endsAt in the future, Past = already passed (FLT-25). */
  @Prop({ type: Date, required: true })
  endsAt: Date;

  //  cancellation & refund (FLT-26, FLT-06, PAY-03)

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: String, enum: Object.values(CancelledBy) })
  cancelledBy?: CancelledBy;

  @Prop({ type: String, trim: true, maxlength: 300 })
  cancellationReason?: string;

  /** Tier % that applied (100 for airline-initiated cancellations). */
  @Prop({ type: Number, min: 0, max: 100 })
  refundPercentage?: number;

  @Prop({ type: Number, min: 0 })
  refundAmount?: number;

  /** Member 5's Refund document (status Pending / Refunded / Failed lives there). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Refund' })
  refundId?: Types.ObjectId;
}

export const FlightBookingSchema = SchemaFactory.createForClass(FlightBooking);



// Indexes

// Unique reference / e-ticket, but only for documents that HAVE one (confirmed bookings).
FlightBookingSchema.index(
  { reference: 1 },
  { unique: true, partialFilterExpression: { reference: { $type: 'string' } } },
);
FlightBookingSchema.index(
  { eTicketNumber: 1 },
  { unique: true, partialFilterExpression: { eTicketNumber: { $type: 'string' } } },
);

// "My bookings" grouped Upcoming / Past / Cancelled (FLT-25).
FlightBookingSchema.index({ userId: 1, status: 1, departureTime: -1 });

// Hold-expiry job (FLT-22): only Pending Payment bookings are ever scanned.
FlightBookingSchema.index(
  { holdExpiresAt: 1 },
  { partialFilterExpression: { status: BookingStatus.PENDING_PAYMENT } },
);

// Moderator view / passenger export (FLT-29) and flight cancellation (FLT-06).
FlightBookingSchema.index({ 'segments.flightId': 1, status: 1 });

// Admin booking list (ACC-17).
FlightBookingSchema.index({ airlineId: 1, createdAt: -1 });
FlightBookingSchema.index({ status: 1, createdAt: -1 });



FlightBookingSchema.pre<FlightBookingDocument>('validate', async function () {
  const expectedSegments = this.tripType === TripType.ROUND_TRIP ? 2 : 1;
  if (this.segments?.length !== expectedSegments) {
    this.invalidate('segments', `A ${this.tripType} booking needs exactly ${expectedSegments} segment(s)`);
  }

  const passengers = this.passengers ?? [];
  const adults = passengers.filter((p) => p.type === PassengerType.ADULT).length;
  const children = passengers.filter((p) => p.type === PassengerType.CHILD).length;
  const infants = passengers.filter((p) => p.type === PassengerType.INFANT).length;

  if (adults < 1) this.invalidate('passengers', 'At least one adult is required (FLT-12b)');
  if (infants > adults) this.invalidate('passengers', 'There cannot be more infants than adults (FLT-12b)');
  if (this.seatCount !== adults + children) {
    this.invalidate('seatCount', 'seatCount must equal adults + children (infants occupy no seat)');
  }

  if (this.status === BookingStatus.PENDING_PAYMENT && !this.holdExpiresAt) {
    this.invalidate('holdExpiresAt', 'A Pending Payment booking needs a holdExpiresAt (FLT-22)');
  }
  if (this.status === BookingStatus.CONFIRMED && !this.reference) {
    this.invalidate('reference', 'A Confirmed booking needs a reference (FLT-23)');
  }
});
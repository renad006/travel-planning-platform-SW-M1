import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BookingType } from '../enums/payment.enums';

export type PolicyAcceptanceDocument = HydratedDocument<PolicyAcceptance>;

@Schema({ timestamps: false })
export class PolicyAcceptance {
  @Prop({ type: String, enum: BookingType, required: true })
  bookingType: BookingType;

  @Prop({ type: Types.ObjectId, required: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true, default: () => new Date() })
  acceptedAt: Date;

  // what the user saw, so later moderator edits don't change what was agreed
  @Prop({ type: Object, required: true })
  policySnapshot: Record<string, unknown>;
}

export const PolicyAcceptanceSchema = SchemaFactory.createForClass(PolicyAcceptance);
PolicyAcceptanceSchema.index({ bookingType: 1, bookingId: 1, userId: 1 }, { unique: true });
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BookingType, RefundStatus } from '../enums/payment.enums';

export type RefundDocument = HydratedDocument<Refund>;

@Schema({ timestamps: true })
export class Refund {
  @Prop({ type: Types.ObjectId, ref: 'Payment', required: true, index: true })
  paymentId: Types.ObjectId;

  @Prop({ type: String, enum: BookingType, required: true })
  bookingType: BookingType;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  percent: number;

  // empty when the refund is 0% (no Stripe call)
  @Prop({ type: String, sparse: true, unique: true })
  stripeRefundId?: string;

  @Prop({ type: String, enum: RefundStatus, default: RefundStatus.PENDING })
  status: RefundStatus;

  @Prop({ type: String })
  reason?: string;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProcessedStripeEventDocument = HydratedDocument<ProcessedStripeEvent>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ProcessedStripeEvent {
  @Prop({ type: String, required: true, unique: true })
  stripeEventId: string;
}

export const ProcessedStripeEventSchema = SchemaFactory.createForClass(ProcessedStripeEvent);
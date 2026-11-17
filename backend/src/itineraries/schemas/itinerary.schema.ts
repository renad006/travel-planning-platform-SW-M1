import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ItineraryDocument = HydratedDocument<Itinerary>;

@Schema({ _id: true })
export class Activity {
  _id: Types.ObjectId;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ trim: true }) description?: string;
  @Prop() time?: string;
  @Prop({ type: Number, min: 0 }) cost?: number;
  @Prop() currency?: string;
  @Prop({ type: [String], default: [] }) images: string[];
}
export const ActivitySchema = SchemaFactory.createForClass(Activity);

@Schema({ _id: true })
export class BudgetEntry {
  _id: Types.ObjectId;
  @Prop({
    required: true,
    enum: ['food', 'accommodation', 'in-city-transport', 'activities'],
  })
  category: 'food' | 'accommodation' | 'in-city-transport' | 'activities';
  @Prop({ required: true, type: Number, min: 0 }) amount: number;
  @Prop({ required: true }) currency: string;
  // ITN-27: set when the entry comes from a booking linked to this day
  @Prop({ type: Types.ObjectId }) bookingId?: Types.ObjectId;
  @Prop({ type: String, enum: ['hotel', 'flight'] }) bookingType?: 'hotel' | 'flight';
}
export const BudgetEntrySchema = SchemaFactory.createForClass(BudgetEntry);

@Schema({ _id: true })
export class TransportCost {
  _id: Types.ObjectId;
  @Prop({ required: true }) mode: string;
  @Prop({ required: true }) fromCity: string;
  @Prop({ required: true }) toCity: string;
  @Prop({ required: true, type: Number, min: 0 }) amount: number;
  @Prop({ required: true }) currency: string;
}
export const TransportCostSchema = SchemaFactory.createForClass(TransportCost);

@Schema({ _id: true })
export class ItineraryDay {
  _id: Types.ObjectId;
  @Prop({ required: true, min: 1 }) dayNumber: number;
  @Prop({ required: true, trim: true }) city: string;
  @Prop({ trim: true }) notes?: string;
  @Prop({ type: [ActivitySchema], default: [] }) activities: Activity[];
  @Prop({ type: [BudgetEntrySchema], default: [] }) budgetEntries: BudgetEntry[];
  @Prop({ type: [TransportCostSchema], default: [] }) transportCosts: TransportCost[];
}
export const ItineraryDaySchema = SchemaFactory.createForClass(ItineraryDay);

@Schema({ timestamps: true })
export class Itinerary {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  @Prop({ type: [String], required: true, default: [] })
  countries: string[];

  @Prop({ required: true }) startDate: Date;

  @Prop({ required: true, enum: ['private', 'public'], default: 'private' })
  visibility: 'private' | 'public';

  @Prop({ type: [ItineraryDaySchema], default: [] })
  days: ItineraryDay[];

  // Clone attribution (used later by ITN-21)
  @Prop({ type: Types.ObjectId, ref: 'User' }) originalAuthorId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Itinerary' }) originalItineraryId?: Types.ObjectId;
}

export const ItinerarySchema = SchemaFactory.createForClass(Itinerary);
ItinerarySchema.index({ userId: 1, updatedAt: -1 });
ItinerarySchema.index({ visibility: 1, updatedAt: -1 });
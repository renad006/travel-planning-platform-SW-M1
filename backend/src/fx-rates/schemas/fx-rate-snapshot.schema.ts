import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FxRateSnapshotDocument = HydratedDocument<FxRateSnapshot>;

/** ITN-18: the exchange rates fetched on one day (one document per UTC day, cached for reuse). */
@Schema({ timestamps: false, collection: 'fxratesnapshots' })
export class FxRateSnapshot {
  /** UTC day of the fetch, for example 2026-11-17. Unique: at most one fetch result per day. */
  @Prop({ required: true, unique: true }) fetchedDay: string;

  @Prop({ required: true }) base: string;

  /** Currency code -> units of that currency for 1 unit of the base. */
  @Prop({ type: Object, required: true }) rates: Record<string, number>;

  /** The date the provider says the rates are from (shown to the user, ITN-18). */
  @Prop({ required: true }) rateDate: Date;

  @Prop({ required: true }) fetchedAt: Date;
}

export const FxRateSnapshotSchema = SchemaFactory.createForClass(FxRateSnapshot);
FxRateSnapshotSchema.index({ fetchedAt: -1 });

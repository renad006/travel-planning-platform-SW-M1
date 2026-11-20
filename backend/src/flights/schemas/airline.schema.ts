import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirlineDocument = HydratedDocument<Airline>;

/** FLT-08 (free bags + max weight live on each cabin, see FLT-04). */
@Schema({ _id: false })
export class BaggagePolicy {
  @Prop({ type: Number, required: true, min: 0.01 })
  extraBagPrice: number;

  @Prop({ type: Number, required: true, min: 0 })
  maxExtraBags: number;
}
const BaggagePolicySchema = SchemaFactory.createForClass(BaggagePolicy);

/** FLT-09: one cancellation tier. */
@Schema({ _id: false })
export class CancellationTier {
  @Prop({ type: Number, required: true, min: 0 })
  daysBeforeDeparture: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  refundPercentage: number;
}
const CancellationTierSchema = SchemaFactory.createForClass(CancellationTier);

@Schema({ timestamps: true })
export class Airline {
  @Prop({ type: String, required: true, unique: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, unique: true, uppercase: true, trim: true })
  iataCode: string;

  /** FLT-01 / GEN-08: URL of the uploaded logo (max 1 per airline). */
  @Prop({ type: String })
  logoUrl?: string;

  /** ACC-15: set to false by an admin to hide the airline from search and booking. */
  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /** Not defined yet => no extra bags can be bought. */
  @Prop({ type: BaggagePolicySchema })
  baggagePolicy?: BaggagePolicy;

  /** Stored sorted by daysBeforeDeparture, highest first. Empty => 0% refund. */
  @Prop({ type: [CancellationTierSchema], default: [] })
  cancellationPolicy: CancellationTier[];
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);

/**
 * Self-healing for airlines saved by OLDER versions of this schema.
 * Using an async function instead of next() prevents TypeScript errors.
 */
AirlineSchema.pre<AirlineDocument>('validate', async function () {
  const baggage = this.baggagePolicy;
  if (baggage && (baggage.extraBagPrice == null || baggage.maxExtraBags == null)) {
    this.baggagePolicy = undefined;
  }
  if (this.cancellationPolicy?.some((t) => t.daysBeforeDeparture == null)) {
    this.cancellationPolicy = this.cancellationPolicy.filter((t) => t.daysBeforeDeparture != null);
  }
});
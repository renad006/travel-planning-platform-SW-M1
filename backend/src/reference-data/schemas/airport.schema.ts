import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirportDocument = HydratedDocument<Airport>;

// FLT-02: read-only reference data, identifiers come straight from Airports.csv
@Schema({ timestamps: false })
export class Airport {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  iataCode: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  cityId: string;

  @Prop({ required: true, uppercase: true, trim: true })
  countryCode: string;

  // IANA time zone, used for GEN-06 and FLT-03
  @Prop({ required: true, trim: true })
  timeZone: string;
}

export const AirportSchema = SchemaFactory.createForClass(Airport);
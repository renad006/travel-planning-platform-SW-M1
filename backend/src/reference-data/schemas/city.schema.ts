import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CityDocument = HydratedDocument<City>;

@Schema({ timestamps: false })
export class City {
  @Prop({ required: true, unique: true, trim: true })
  cityId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, uppercase: true, trim: true, index: true })
  countryCode: string;
}

export const CitySchema = SchemaFactory.createForClass(City);
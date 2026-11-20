import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AttractionDocument = HydratedDocument<Attraction>;

@Schema({ timestamps: false })
export class Attraction {
  @Prop({ required: true, unique: true, trim: true })
  attractionId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  cityId: string;
}

export const AttractionSchema = SchemaFactory.createForClass(Attraction);
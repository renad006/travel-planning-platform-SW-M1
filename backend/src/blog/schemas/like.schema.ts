import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LikeDocument = HydratedDocument<Like>;

@Schema({ timestamps: true })
export class Like {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
}

export const LikeSchema = SchemaFactory.createForClass(Like);

// BLG-06: A user can like a post at most once. 
// This unique compound index guarantees it at the database level.
LikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
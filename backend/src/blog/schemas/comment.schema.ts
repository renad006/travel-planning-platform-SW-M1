import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true, maxlength: 500 })
  text: string;

  @Prop({ default: false })
  isHidden: boolean;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// Chronological order for comments on a specific post
CommentSchema.index({ postId: 1, createdAt: 1 });
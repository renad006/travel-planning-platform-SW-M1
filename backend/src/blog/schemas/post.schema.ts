import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

export enum PostStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
}

@Schema({ timestamps: true })
export class Post {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  body: string;

    @Prop({ type: Types.ObjectId, ref: 'Itinerary' })
  itineraryId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({
    type: [{ id: String, url: String, filename: String }],
    default: [],
  })
  images: { id: string; url: string; filename: string }[];

  @Prop({ type: String, enum: PostStatus, default: PostStatus.DRAFT })
  status: PostStatus;

  @Prop({ default: false })
  isHidden: boolean;

  @Prop({ default: 0 })
  likeCount: number;

  @Prop({ default: 0 })
  commentCount: number;

  @Prop({ default: 0 })
  interactionScore: number; // likes + comments

  @Prop({ type: Date })
  publishedAt?: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Indexes for search, sorting, and filtering
PostSchema.index({ status: 1, isHidden: 1, tags: 1 });
PostSchema.index({ interactionScore: -1, publishedAt: -1 });
PostSchema.index({ authorId: 1 });
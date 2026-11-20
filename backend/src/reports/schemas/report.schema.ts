import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReportDocument = HydratedDocument<Report>;

export enum ReportTargetType {
  POST = 'post',
  COMMENT = 'comment',
  REVIEW = 'review',
  ITINERARY = 'itinerary',
}

export enum ReportStatus {
  OPEN = 'Open',
  DISMISSED = 'Dismissed',
  HIDDEN = 'Hidden',
  DELETED = 'Deleted',
}

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporterId: Types.ObjectId;

  @Prop({ type: String, enum: ReportTargetType, required: true })
  targetType: ReportTargetType;

  @Prop({ type: Types.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ required: true })
  reason: string;

  @Prop({ type: String, enum: ReportStatus, default: ReportStatus.OPEN })
  status: ReportStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop()
  resolutionNote?: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// GEN-09: One report per user per item
ReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
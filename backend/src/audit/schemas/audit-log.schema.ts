import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: { createdAt: 'timestamp', updatedAt: false } })
export class AuditLog {
  @Prop({ required: true, index: true })
  actorId: string;

  @Prop({ type: String, enum: Role, required: true })
  actorRole: Role;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true, index: true })
  targetType: string;

  @Prop({ required: true })
  targetId: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  // Filled automatically by Mongoose (createdAt is renamed to timestamp)
  timestamp?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
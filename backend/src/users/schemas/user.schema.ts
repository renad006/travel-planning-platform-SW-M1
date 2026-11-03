import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { ProviderType } from '../../common/enums/provider-type.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Never returned by default; load explicitly with .select('+password')
  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: String, enum: Role, default: Role.USER })
  role: Role;

  @Prop({ type: String, enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Prop({ default: 0 })
  failedLoginCount: number;

  @Prop({ type: Date, default: null })
  lockUntil: Date | null;

  // Profile fields: adjust to match ACC-09 in the requirements sheet
  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({ type: Object, default: {} })
  preferences: Record<string, unknown>;

  // Moderators manage exactly one provider
  @Prop({ type: String, enum: ProviderType })
  assignedProviderType?: ProviderType;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  assignedProviderId?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);
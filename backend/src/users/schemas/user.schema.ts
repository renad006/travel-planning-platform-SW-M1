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

  // ACC-05: 5 consecutive failures lock the account for 15 minutes
  @Prop({ default: 0 })
  failedLoginCount: number;

  @Prop({ type: Date, default: null })
  lockUntil: Date | null;

  // ACC-09: editable profile fields
  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true, uppercase: true, default: 'USD' })
  preferredCurrency: string;

  // ACC-07a / ACC-13: temporary password must be replaced at next login
  @Prop({ default: false })
  mustChangePassword: boolean;

  // ACC-01: mandatory terms-and-privacy consent
  @Prop({ type: Date })
  termsAcceptedAt?: Date;

  // Moderators manage exactly one provider
  @Prop({ type: String, enum: ProviderType })
  assignedProviderType?: ProviderType;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  assignedProviderId?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Never leak credentials or lockout internals in any API response
UserSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    const safe = ret as unknown as Record<string, unknown>;
    delete safe.password;
    delete safe.failedLoginCount;
    delete safe.lockUntil;
    return safe;
  },
});
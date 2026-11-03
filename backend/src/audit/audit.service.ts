import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditLogInput {
  actor: { id: string; role: Role };
  action: string; // e.g. 'ACCOUNT_SUSPENDED'
  targetType: string; // e.g. 'user', 'booking', 'post'
  targetId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.auditModel.create({
      actorId: input.actor.id,
      actorRole: input.actor.role,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
    });
  }
}
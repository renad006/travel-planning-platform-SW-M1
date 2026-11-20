import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import {
  buildPaginatedResponse,
  getSkip,
} from '../common/utils/pagination.helper';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
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

  // GEN-07: paginated audit log query for admins
  async findAll(query: ListAuditLogsDto) {
    const filter: Record<string, unknown> = {};
    if (query.actorId) filter.actorId = query.actorId;
    if (query.action) filter.action = query.action;
    if (query.targetType) filter.targetType = query.targetType;
    if (query.targetId) filter.targetId = query.targetId;

    if (query.from || query.to) {
      const range: { $gte?: Date; $lte?: Date } = {};
      if (query.from) range.$gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        // A date-only value (2026-11-13) includes the whole day
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
          to.setUTCHours(23, 59, 59, 999);
        }
        range.$lte = to;
      }
      if (range.$gte && range.$lte && range.$gte > range.$lte) {
        throw new BadRequestException('"from" must be before "to"');
      }
      filter.timestamp = range;
    }

    const sortField = query.sortBy === 'action' ? 'action' : 'timestamp';
    const [items, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ [sortField]: query.sortOrder === 'asc' ? 1 : -1 })
        .skip(getSkip(query))
        .limit(query.limit)
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);
    return buildPaginatedResponse(items, total, query);
  }
}
import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument, ReportStatus } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { Post, PostDocument } from '../blog/schemas/post.schema';
import { Comment, CommentDocument } from '../blog/schemas/comment.schema';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '../common/enums/role.enum';
import { ResolveReportDto, ReportAction } from './dto/resolve-report.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class ReportsService {
   constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReport(reporterId: string, dto: CreateReportDto) {
    // TODO GEN-09: Verify the target actually exists based on targetType.
    // For now, we assume it's valid and just save the report.
    try {
      const report = await this.reportModel.create({
        reporterId: new Types.ObjectId(reporterId),
        targetType: dto.targetType,
        targetId: new Types.ObjectId(dto.targetId),
        reason: dto.reason,
        status: ReportStatus.OPEN,
      });
      return report;
    } catch (error) {
      if ((error as any).code === 11000) {
        throw new ConflictException('You have already reported this item');
      }
      throw error;
    }
  }
    async directModerateContent(
    type: string,
    id: string,
    adminId: string,
    action: 'hide' | 'delete',
  ) {
    let authorId = null;

    // 1. Handle the content
    if (type === 'post') {
      const post = await this.postModel.findById(id);
      if (!post) throw new NotFoundException('Post not found');
      authorId = post.authorId.toString();
      
      if (action === 'hide') {
        post.isHidden = true;
        await post.save();
      } else {
        await post.deleteOne();
      }
    } else if (type === 'comment') {
      const comment = await this.commentModel.findById(id);
      if (!comment) throw new NotFoundException('Comment not found');
      authorId = comment.authorId.toString();
      
      if (action === 'hide') {
        comment.isHidden = true;
        await comment.save();
      } else {
        await comment.deleteOne();
      }
    } else {
      throw new BadRequestException('Invalid content type');
    }

    // 2. Log the action
       await this.auditService.log({
      actor: { id: adminId, role: Role.ADMIN }, // <--- FIXED HERE
      action: `DIRECT_${action.toUpperCase()}`,
      targetType: type,
      targetId: id,
      metadata: { source: 'direct_admin_action' },
    });

    // 3. Notify the author
    if (authorId) {
      await this.notificationsService.notify({
        userId: authorId,
        type: 'CONTENT_MODERATED',
        title: `Content ${action}ed`,
        message: `Your ${type} was ${action}ed by an admin.`,
        related: { type, id },
      });
    }

    return { message: `Content ${action}ed successfully` };
  }
    async getOpenReports(dto: PaginationQueryDto) {
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    const query = { status: ReportStatus.OPEN };

    const [reports, total] = await Promise.all([
      this.reportModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.reportModel.countDocuments(query).exec(),
    ]);

    return {
      data: reports,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async resolveReport(reportId: string, adminId: string, dto: ResolveReportDto) {
    const report = await this.reportModel.findById(reportId);
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.OPEN) {
      throw new ConflictException('Report is already resolved');
    }

    let authorId = null;

    if (dto.action === ReportAction.HIDE || dto.action === ReportAction.DELETE) {
      const isHide = dto.action === ReportAction.HIDE;
      
      if (report.targetType === 'post') {
        const post = await this.postModel.findById(report.targetId);
        if (post) {
          authorId = post.authorId.toString();
          if (isHide) {
            post.isHidden = true;
            await post.save();
          } else {
            await post.deleteOne();
          }
        }
      } else if (report.targetType === 'comment') {
        const comment = await this.commentModel.findById(report.targetId);
        if (comment) {
          authorId = comment.authorId.toString();
          if (isHide) {
            comment.isHidden = true;
            await comment.save();
          } else {
            await comment.deleteOne();
          }
        }
      } 
    }

    report.status = dto.action === ReportAction.DISMISS ? ReportStatus.DISMISSED : 
                    dto.action === ReportAction.HIDE ? ReportStatus.HIDDEN : ReportStatus.DELETED;
    report.resolvedBy = new Types.ObjectId(adminId);
    report.resolvedAt = new Date();
    if (dto.note) report.resolutionNote = dto.note;
    await report.save();

    // FIXED: Matching your exact AuditService signature
    await this.auditService.log({
      actor: { id: adminId, role: Role.ADMIN },
      action: `MODERATION_${dto.action.toUpperCase()}`,
      targetType: report.targetType,
      targetId: report.targetId.toString(),
      metadata: { reportId: report.id, note: dto.note || 'none' },
    });

    if (authorId && dto.action !== ReportAction.DISMISS) {
      await this.notificationsService.notify({
        userId: authorId,
        type: 'CONTENT_MODERATED',
        title: `Content ${dto.action}ed`,
        message: `Your ${report.targetType} was ${dto.action}ed by an admin. Note: ${dto.note || 'No note provided'}`,
        related: { type: report.targetType, id: report.targetId.toString() },
      });
    }

    return { message: `Report resolved with action: ${dto.action}` };
  }
}
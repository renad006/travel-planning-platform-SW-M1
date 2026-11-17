import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument, ReportStatus } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
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
}
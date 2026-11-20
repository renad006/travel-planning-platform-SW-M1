import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Report content (GEN-09)' })
  async createReport(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.createReport(user._id.toString(), dto);
  }
}
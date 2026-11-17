import { Controller, Get, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Admin - Moderation')
@Controller('admin/reports')
@Roles(Role.ADMIN)
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List open reports (GEN-10)' })
  async getOpenReports(@Query() dto: PaginationQueryDto) {
    return this.reportsService.getOpenReports(dto);
  }

  @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Resolve a report (GEN-10)' })
  async resolveReport(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportsService.resolveReport(id, user._id.toString(), dto);
  }

  @Patch('content/:type/:id/hide')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Directly hide content (GEN-10)' })
  async directHide(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.reportsService.directModerateContent(type, id, user._id.toString(), 'hide');
  }

  @Delete('content/:type/:id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Directly delete content (GEN-10)' })
  async directDelete(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.reportsService.directModerateContent(type, id, user._id.toString(), 'delete');
  }
}
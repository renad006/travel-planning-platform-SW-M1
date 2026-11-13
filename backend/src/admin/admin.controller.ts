import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ListAuditLogsDto } from '../audit/dto/list-audit-logs.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminService } from './admin.service';
import { CreateModeratorDto } from './dto/create-moderator.dto';

@ApiTags('Admin')
@ApiCookieAuth('access_token')
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('moderators')
  @ApiOperation({
    summary:
      'ACC-13: create an airline or hotel moderator linked to one provider',
    description:
      'Admin only. Generates a temporary password (returned once) and sets mustChangePassword so the moderator must change it at first login.',
  })
  @ApiCreatedResponse({ description: 'Moderator created (ACC-13)' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'Provider not found' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  createModerator(
    @Body() dto: CreateModeratorDto,
    @CurrentUser() admin: UserDocument,
  ) {
    return this.adminService.createModerator(dto, admin);
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'ACC-07a: admin resets a user password',
    description:
      'Admin only. Generates a temporary password (returned once), sets mustChangePassword, writes an audit log and notifies the user.',
  })
  @ApiOkResponse({ description: 'Password reset (ACC-07a)' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  resetUserPassword(
    @Param('id') id: string,
    @CurrentUser() admin: UserDocument,
  ) {
    return this.adminService.resetUserPassword(id, admin);
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'GEN-07: list audit logs',
    description:
      'Admin only. Paginated, newest first. Filter by actorId, action, targetType, targetId and a from/to date range.',
  })
  @ApiOkResponse({ description: 'Paginated audit logs (GEN-07)' })
  @ApiBadRequestResponse({ description: 'Invalid filter or date range' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  listAuditLogs(@Query() query: ListAuditLogsDto) {
    return this.adminService.listAuditLogs(query);
  }
}
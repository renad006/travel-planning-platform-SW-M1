import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiCookieAuth('access_token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'GEN-01: list my notifications',
    description:
      'Paginated, newest first. Use unread=true to return only unread notifications. Users only ever see their own notifications.',
  })
  @ApiOkResponse({ description: 'Paginated notifications (GEN-01)' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  findMine(
    @CurrentUser() user: UserDocument,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.findMine(user.id, query);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'GEN-01: mark all my notifications as read',
    description: 'Returns how many notifications were updated.',
  })
  @ApiOkResponse({ description: 'All notifications marked as read (GEN-01)' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  markAllRead(@CurrentUser() user: UserDocument) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'GEN-01: mark one notification as read',
    description: 'Only the owner of the notification may mark it as read.',
  })
  @ApiOkResponse({ description: 'Notification marked as read (GEN-01)' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @ApiForbiddenResponse({ description: 'Notification belongs to another user' })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  markRead(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.notificationsService.markRead(id, user.id);
  }
}
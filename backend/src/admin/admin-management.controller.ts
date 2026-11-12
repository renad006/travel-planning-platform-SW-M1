import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ProviderType } from '../common/enums/provider-type.enum';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminManagementService } from './admin-management.service';
import { ListAccountsDto } from './dto/list-accounts.dto';
import { ListAdminBookingsDto } from './dto/list-admin-bookings.dto';

@ApiTags('Admin')
@ApiCookieAuth('access_token')
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@ApiForbiddenResponse({ description: 'Admin role required' })
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminManagementController {
  constructor(private readonly management: AdminManagementService) {}

  @Get('accounts')
  @ApiOperation({
    summary:
      'ACC-14: list all accounts (paginated, search by name or email, filter by role and status)',
  })
  @ApiOkResponse({ description: 'Paginated accounts (ACC-14)' })
  listAccounts(@Query() query: ListAccountsDto) {
    return this.management.listAccounts(query);
  }

  @Patch('accounts/:id/suspend')
  @ApiOperation({
    summary: 'ACC-15 / ACC-16: suspend a moderator or user account',
    description:
      'A suspended account cannot log in. Existing bookings stay valid. The account owner gets an in-app notification and an audit log entry is written.',
  })
  @ApiOkResponse({ description: 'Account suspended' })
  @ApiBadRequestResponse({ description: 'Invalid id, own account, or account deactivated by its owner' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  @ApiConflictResponse({ description: 'Account is already suspended' })
  suspend(@CurrentUser() actor: UserDocument, @Param('id') id: string) {
    return this.management.suspend(actor, id);
  }

  @Patch('accounts/:id/reactivate')
  @ApiOperation({ summary: 'ACC-15 / ACC-16: reactivate a suspended account' })
  @ApiOkResponse({ description: 'Account reactivated' })
  @ApiBadRequestResponse({ description: 'Invalid id, own account, or account deactivated by its owner' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  @ApiConflictResponse({ description: 'Account is not suspended' })
  reactivate(@CurrentUser() actor: UserDocument, @Param('id') id: string) {
    return this.management.reactivate(actor, id);
  }

  @Patch('providers/:type/:id/deactivate')
  @ApiOperation({
    summary: 'ACC-15: deactivate a hotel or airline',
    description:
      'The provider is hidden from search and cannot be booked. Existing Confirmed bookings remain valid. Its moderators get an in-app notification.',
  })
  @ApiParam({ name: 'type', enum: ProviderType })
  @ApiOkResponse({ description: 'Provider deactivated' })
  @ApiBadRequestResponse({ description: 'Invalid type or id' })
  @ApiNotFoundResponse({ description: 'Provider not found' })
  @ApiConflictResponse({ description: 'Provider is already deactivated' })
  deactivateProvider(
    @CurrentUser() actor: UserDocument,
    @Param('type', new ParseEnumPipe(ProviderType)) type: ProviderType,
    @Param('id') id: string,
  ) {
    return this.management.setProviderActive(actor, type, id, false);
  }

  @Patch('providers/:type/:id/reactivate')
  @ApiOperation({ summary: 'ACC-15: reactivate a hotel or airline' })
  @ApiParam({ name: 'type', enum: ProviderType })
  @ApiOkResponse({ description: 'Provider reactivated' })
  @ApiBadRequestResponse({ description: 'Invalid type or id' })
  @ApiNotFoundResponse({ description: 'Provider not found' })
  @ApiConflictResponse({ description: 'Provider is already active' })
  reactivateProvider(
    @CurrentUser() actor: UserDocument,
    @Param('type', new ParseEnumPipe(ProviderType)) type: ProviderType,
    @Param('id') id: string,
  ) {
    return this.management.setProviderActive(actor, type, id, true);
  }

  @Get('bookings')
  @ApiOperation({
    summary:
      'ACC-17: read-only list of all flight and hotel bookings (filter by type, status, date range)',
  })
  @ApiOkResponse({ description: 'Paginated bookings (ACC-17)' })
  listBookings(@Query() query: ListAdminBookingsDto) {
    return this.management.listBookings(query);
  }
}
import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { RefundsService } from './refunds.service';

@ApiTags('Payments')
@ApiCookieAuth('access_token')
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'PAY-03: get a refund by id (owner or admin only)' })
  @ApiOkResponse({ description: 'Refund details' })
  @ApiNotFoundResponse({ description: 'Refund not found' })
  getRefund(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.refundsService.getRefund(
      user.id,
      id,
      user.role === Role.ADMIN,
    );
  }
}
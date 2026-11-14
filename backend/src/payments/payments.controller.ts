import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { AcceptPolicyDto } from './dto/accept-policy.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiCookieAuth('access_token')
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('policies/accept')
  @ApiOperation({
    summary:
      "PAY-02: accept a booking's policies (cancellation/baggage for flights, cancellation/check-in-out for hotels) before paying",
  })
  @ApiCreatedResponse({ description: 'Policies accepted' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({
    description: 'Policies already accepted for this booking',
  })
  acceptPolicies(
    @CurrentUser() user: UserDocument,
    @Body() dto: AcceptPolicyDto,
  ) {
    return this.paymentsService.acceptPolicies(
      user.id,
      dto.bookingType,
      dto.bookingId,
    );
  }
}
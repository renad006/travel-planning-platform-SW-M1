import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AcceptPolicyDto } from './dto/accept-policy.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FlightChangePaymentDto } from './dto/flight-change-payment.dto';
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

  @Post()
  @ApiOperation({
    summary: 'PAY-01: create a Stripe PaymentIntent for a Pending Payment booking',
  })
  @ApiCreatedResponse({ description: 'PaymentIntent created' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({
    description:
      'Booking is not awaiting payment, the hold has expired, or policies were not accepted',
  })
  createPayment(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(user.id, dto);
  }

  @Post('flight-change')
  @ApiOperation({
    summary:
      'FLT-27: create a Stripe PaymentIntent for the price difference of a pending flight change',
  })
  @ApiCreatedResponse({ description: 'PaymentIntent created' })
  @ApiNotFoundResponse({
    description: 'Booking not found, or no pending change with this id',
  })
  createFlightChangePayment(
    @CurrentUser() user: UserDocument,
    @Body() dto: FlightChangePaymentDto,
  ) {
    return this.paymentsService.createFlightChangePayment(user.id, dto);
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'PAY-01: retry a failed payment with a new PaymentIntent before the hold expires',
  })
  @ApiCreatedResponse({ description: 'New PaymentIntent created' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiConflictResponse({
    description: 'Booking is not awaiting payment or the hold has expired',
  })
  retryPayment(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.paymentsService.retryPayment(user.id, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'PAY-01: get a payment by id (owner or admin only)' })
  @ApiOkResponse({ description: 'Payment details' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  getPayment(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.paymentsService.getPayment(
      user.id,
      id,
      user.role === Role.ADMIN,
    );
  }

  @Public()
  @Post('webhook')
  @ApiOperation({
    summary:
      'PAY-01: Stripe webhook (no login — verified by Stripe signature instead)',
  })
  @ApiOkResponse({ description: 'Event processed' })
  @ApiBadRequestResponse({ description: 'Invalid Stripe signature' })
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }
    await this.paymentsService.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
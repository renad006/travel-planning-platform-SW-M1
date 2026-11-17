import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { HotelBookingsService } from './hotel-bookings.service';

@ApiTags('Hotel bookings')
@ApiCookieAuth()
@Controller('hotel-bookings')
export class HotelBookingsController {
  constructor(private readonly bookingsService: HotelBookingsService) {}

  @Post()
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Hold rooms for 10 minutes as a Pending Payment reservation (HTL-16, HTL-18)',
  })
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateHotelBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @Get()
  @Roles(Role.USER)
  @ApiOperation({ summary: 'My reservations: Upcoming, Past and Cancelled (HTL-20)' })
  listMine(@CurrentUser() user: UserDocument) {
    return this.bookingsService.listMine(user.id);
  }

  @Get(':id/refund-preview')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'See the refund I would get if I cancel this reservation now (HTL-21)',
  })
  refundPreview(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.bookingsService.refundPreview(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Cancel my whole Confirmed reservation before check-in (HTL-21, PAY-03)',
    description:
      'The rooms are released and Payments is told to refund according to the hotel tiers. ' +
      'Ask for confirmation first, after showing the refund preview.',
  })
  cancel(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.bookingsService.cancel(user.id, id);
  }

  @Get(':id')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Details of one of my reservations (HTL-20)' })
  findMine(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.bookingsService.findMine(user.id, id);
  }

  // shortcut: test-only helpers so bookings can be confirmed or completed without
  // Stripe in Swagger. Delete both routes (and their service methods) before submission.
  @Post(':id/test-confirm')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'TEST ONLY: confirm a pending reservation as if payment succeeded',
  })
  testConfirm(@Param('id') id: string) {
    return this.bookingsService.testConfirm(id);
  }

  @Post(':id/test-complete')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'TEST ONLY: mark a confirmed reservation as Completed (for reviews)',
  })
  testComplete(@Param('id') id: string) {
    return this.bookingsService.testComplete(id);
  }
}

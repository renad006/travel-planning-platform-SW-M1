import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Get(':id')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Details of one of my reservations (HTL-20)' })
  findMine(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.bookingsService.findMine(user.id, id);
  }
}

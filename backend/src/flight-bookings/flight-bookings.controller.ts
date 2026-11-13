import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';
import { FlightBookingsService } from './flight-bookings.service';

/**
 * Flight bookings of the logged-in user (FLT-19 to FLT-26).
 * Every endpoint is for registered users only and only ever touches the caller's own bookings.
 */
@ApiTags('Flight Bookings')
@ApiCookieAuth('access_token')
@Roles(Role.USER)
@Controller('flight-bookings')
export class FlightBookingsController {
  constructor(private readonly service: FlightBookingsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Booking summary before payment (FLT-19, FLT-21)',
    description:
      'Validates the passengers and baggage and returns the priced booking summary. ' +
      'Nothing is reserved yet: call POST /flight-bookings/hold to hold the seats.',
  })
  @ApiConflictResponse({
    description: 'Flight not bookable or not enough seats',
  })
  quote(@Body() dto: CreateFlightBookingDto) {
    return this.service.quote(dto);
  }

  @Post('hold')
  @ApiOperation({
    summary: 'Hold the seats and proceed to payment (FLT-22)',
    description:
      'Atomically reserves the seats and creates a Pending Payment booking held for 10 minutes. ' +
      'If the payment does not succeed in time the booking becomes Expired and the seats are released. ' +
      'Concurrent requests can never book more seats than available.',
  })
  @ApiConflictResponse({
    description: 'Not enough seats / flight not bookable',
  })
  hold(@CurrentUser() user: UserDocument, @Body() dto: CreateFlightBookingDto) {
    return this.service.hold(String(user._id), dto);
  }
}

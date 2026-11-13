import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
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
}

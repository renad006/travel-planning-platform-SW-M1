import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { UserDocument } from '../../users/schemas/user.schema';
import { SegmentDirection } from '../schemas/flight-booking.enums';
import { SeatSegmentQueryDto, SelectSeatDto } from './dto/seat.dto';
import { FlightSeatsService } from './flight-seats.service';

/**
 * Member 3: FLT-28 seat selection (bonus), PATCH /flight-bookings/:id/seat as in the project
 * description. The GET on the same path shows the seat map. Own Confirmed bookings only.
 */
@ApiTags('Flight Bookings')
@ApiCookieAuth('access_token')
@Roles(Role.USER)
@Controller('flight-bookings')
export class FlightSeatsController {
  constructor(private readonly service: FlightSeatsService) {}

  @Get(':id/seat')
  @ApiOperation({
    summary: 'FLT-28: seat map of one flight of my Confirmed booking (Available / Taken / Yours)',
    description:
      'segment is outbound (default) or return (round trips). Choosing is optional: 24 hours before ' +
      'departure every passenger without a seat gets one automatically.',
  })
  @ApiOkResponse({ description: 'The seat map and the seat chosen for each passenger' })
  @ApiNotFoundResponse({ description: 'Not found, or not your booking' })
  @ApiConflictResponse({ description: 'Not Confirmed, or the flight already departed' })
  seatMap(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Query() query: SeatSegmentQueryDto,
  ) {
    return this.service.getSeatMap(String(user._id), id, query.segment ?? SegmentDirection.OUTBOUND);
  }

  @Patch(':id/seat')
  @ApiOperation({
    summary: 'FLT-28: choose or change the seat of one passenger',
    description:
      'Each adult or child can pick a seat 3 times in total (the first pick and two changes). ' +
      'Infants do not take a seat. Closed 24 hours before departure. Seats are free.',
  })
  @ApiOkResponse({ description: 'The seat is assigned' })
  @ApiBadRequestResponse({ description: 'Unknown seat, unknown passenger, or an infant' })
  @ApiNotFoundResponse({ description: 'Not found, or not your booking' })
  @ApiConflictResponse({
    description:
      'The seat is already taken, all 3 picks are used, seat changes are closed, or the booking is not Confirmed / already departed',
  })
  selectSeat(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: SelectSeatDto,
  ) {
    return this.service.selectSeat(String(user._id), id, dto);
  }
}

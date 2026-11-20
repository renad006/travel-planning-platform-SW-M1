import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
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
import { ChangeFlightDto } from './dto/change-flight.dto';
import { ChangeOptionsQueryDto } from './dto/change-options-query.dto';
import { FlightChangesService } from './flight-changes.service';

/** Member 3: FLT-27 changing a flight (bonus). Own Confirmed bookings only. */
@ApiTags('Flight Bookings')
@ApiCookieAuth('access_token')
@Roles(Role.USER)
@Controller('flight-bookings')
export class FlightChangesController {
  constructor(private readonly service: FlightChangesService) {}

  @Get(':id/change-options')
  @ApiOperation({
    summary: 'FLT-27: flights I can change this booking to, with the fare difference',
    description:
      'Same airline, same route, same cabin, Scheduled flights with enough seats. Each option ' +
      'shows fareDifference (direction "pay" = dearer, "refund" = cheaper, "none") and ' +
      'canChange / reason. Read-only: show it before the user confirms the change.',
  })
  @ApiOkResponse({ description: 'The current flight and the possible new flights' })
  @ApiBadRequestResponse({ description: 'This booking has no return flight (one-way booking)' })
  @ApiNotFoundResponse({ description: 'Not found, or not your booking' })
  @ApiConflictResponse({ description: 'Not Confirmed, or the flight already departed' })
  options(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Query() query: ChangeOptionsQueryDto,
  ) {
    return this.service.getOptions(
      String(user._id),
      id,
      query.segment ?? SegmentDirection.OUTBOUND,
      query.date,
    );
  }

  @Patch(':id/change-flight')
  @ApiOperation({
    summary: 'FLT-27: change one flight of my Confirmed booking to another flight',
    description:
      'Same airline, same route, same cabin, before the flight departs. segment is outbound ' +
      '(default) or return. Same price: done at once. Cheaper: done at once and the difference is ' +
      'refunded (event flight-booking.fare-reduced for Payments). A more expensive flight: the ' +
      'new seats are held for 10 minutes and the response shows `pendingChange` (amountDue, ' +
      'holdExpiresAt); the booking moves only after the difference is paid. Seats chosen on the old flight (FLT-28) are cleared; reference and e-ticket ' +
      'number stay the same. Baggage fees do not change.',
  })
  @ApiOkResponse({ description: 'The updated booking (dearer flight: with pendingChange waiting for payment)' })
  @ApiBadRequestResponse({
    description: 'Same flight, another airline or route, or no such flight in this booking',
  })
  @ApiNotFoundResponse({ description: 'Booking or flight not found, or not your booking' })
  @ApiConflictResponse({
    description:
      'Not Confirmed, already departed, flight not available, not enough seats, round-trip order ' +
      'broken, passenger group would change, bag weight too high, or another change is already waiting for payment',
  })
  change(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: ChangeFlightDto,
  ) {
    return this.service.changeFlight(String(user._id), id, dto);
  }

  @Delete(':id/change-flight')
  @ApiOperation({
    summary: 'FLT-27: cancel a flight change that is waiting for payment',
    description:
      'Only for a change to a more expensive flight that was not paid yet. Its held seats are ' +
      'released at once. The booking was never moved, so nothing else changes.',
  })
  @ApiOkResponse({ description: 'The booking, without pendingChange' })
  @ApiNotFoundResponse({ description: 'Not found, or not your booking' })
  @ApiConflictResponse({ description: 'No change is waiting for payment' })
  cancelPending(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.service.cancelPendingChange(String(user._id), id);
  }
}

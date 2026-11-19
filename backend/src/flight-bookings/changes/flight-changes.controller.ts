import { Controller, Get, Param, Query } from '@nestjs/common';
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
}

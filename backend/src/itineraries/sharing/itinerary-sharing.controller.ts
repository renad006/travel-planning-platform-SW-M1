import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { UserDocument } from '../../users/schemas/user.schema';
import { SearchSharedItinerariesDto } from './dto/search-shared-itineraries.dto';
import { SetVisibilityDto } from './dto/set-visibility.dto';
import { ItinerarySharingService } from './itinerary-sharing.service';

/** Member 3: sharing of itineraries (ITN-20 visibility; search, view and clone follow in ITN-21). */
@ApiTags('Itinerary sharing')
@Controller()
export class ItinerarySharingController {
  constructor(private readonly service: ItinerarySharingService) {}

  // The shared (public) itineraries live under /shared-itineraries, so they can never clash
  // with Member 6's GET /itineraries/:id.
  @Public()
  @Get('shared-itineraries')
  @ApiOperation({
    summary: 'ITN-21: search public itineraries by keyword, country, city and duration (guests allowed)',
  })
  @ApiOkResponse({ description: 'A page of public itineraries, newest changes first' })
  @ApiBadRequestResponse({ description: 'Invalid filter, or minDays is greater than maxDays' })
  search(@Query() query: SearchSharedItinerariesDto) {
    return this.service.search(query);
  }

  @Public()
  @Get('shared-itineraries/:id')
  @ApiOperation({
    summary: 'ITN-21: view a public itinerary read-only: author, days, activities and budget (guests allowed)',
  })
  @ApiOkResponse({ description: 'The public itinerary' })
  @ApiNotFoundResponse({ description: 'Not found, private, or hidden' })
  view(@Param('id') id: string) {
    return this.service.viewPublic(id);
  }

  @Patch('itineraries/:id/visibility')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'ITN-20: set my itinerary to Public or Private (Private removes it from shared search at once)',
  })
  @ApiOkResponse({ description: 'Visibility updated' })
  @ApiBadRequestResponse({ description: 'visibility is missing or not public/private' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @ApiNotFoundResponse({ description: 'Itinerary not found, or it is not yours' })
  setVisibility(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: SetVisibilityDto,
  ) {
    return this.service.setVisibility(user._id.toString(), id, dto.visibility);
  }
}

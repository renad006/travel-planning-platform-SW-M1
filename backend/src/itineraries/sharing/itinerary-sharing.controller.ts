import { Body, Controller, Param, Patch } from '@nestjs/common';
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
import type { UserDocument } from '../../users/schemas/user.schema';
import { SetVisibilityDto } from './dto/set-visibility.dto';
import { ItinerarySharingService } from './itinerary-sharing.service';

/** Member 3: sharing of itineraries (ITN-20 visibility; search, view and clone follow in ITN-21). */
@ApiTags('Itinerary sharing')
@Controller('itineraries')
export class ItinerarySharingController {
  constructor(private readonly service: ItinerarySharingService) {}

  @Patch(':id/visibility')
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

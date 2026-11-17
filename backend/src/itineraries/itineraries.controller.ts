import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';

@ApiTags('Itineraries')
@ApiCookieAuth('access_token')
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@Controller('itineraries')
export class ItinerariesController {
  constructor(private readonly service: ItinerariesService) {}

  @Post()
  @ApiOperation({ summary: 'ITN-01: create an itinerary (private by default)' })
  @ApiCreatedResponse({ description: 'Itinerary created' })
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateItineraryDto) {
    return this.service.create(user._id.toString(), dto);
  }

  @Get()
  @ApiOperation({ summary: 'ITN-03: list my itineraries, most recently updated first' })
  @ApiOkResponse({ description: 'My itineraries' })
  findAllMine(@CurrentUser() user: UserDocument) {
    return this.service.findAllMine(user._id.toString());
  }

  @Get(':id')
  @ApiOperation({ summary: 'ITN-03: view one of my itineraries' })
  @ApiOkResponse({ description: 'Itinerary details' })
  @ApiNotFoundResponse({ description: 'Not found or not owned by you' })
  findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.service.findMine(user._id.toString(), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ITN-01: edit title, countries, start date' })
  @ApiOkResponse({ description: 'Itinerary updated' })
  update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: UpdateItineraryDto) {
    return this.service.update(user._id.toString(), id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ITN-01: delete an itinerary' })
  @ApiOkResponse({ description: 'Itinerary deleted' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.service.remove(user._id.toString(), id);
  }
}
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCookieAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { CreateItineraryDayDto } from './dto/create-itinerary-day.dto';
import { UpdateItineraryDayDto } from './dto/update-itinerary-day.dto';
import { ReorderDayDto } from './dto/reorder-day.dto';

@ApiTags('Itineraries')
@ApiCookieAuth('access_token')
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@Controller('itineraries')
export class ItinerariesController {
  constructor(private readonly service: ItinerariesService) {}

  // --- Phase 1 Endpoints ---
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

  // --- Phase 2 Endpoints ---
  @Post(':id/days')
  @ApiOperation({ summary: 'ITN-05: add a day to the itinerary (max 60)' })
  @ApiCreatedResponse({ description: 'Day added' })
  @ApiBadRequestResponse({ description: 'Itinerary already has 60 days' })
  addDay(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: CreateItineraryDayDto) {
    return this.service.addDay(user._id.toString(), id, dto);
  }

  @Patch(':id/days/:dayId')
  @ApiOperation({ summary: 'ITN-05: edit a day\'s city or notes' })
  @ApiOkResponse({ description: 'Day updated' })
  @ApiNotFoundResponse({ description: 'Day not found' })
  updateDay(
    @CurrentUser() user: UserDocument, 
    @Param('id') id: string, 
    @Param('dayId') dayId: string, 
    @Body() dto: UpdateItineraryDayDto
  ) {
    return this.service.updateDay(user._id.toString(), id, dayId, dto);
  }

  @Delete(':id/days/:dayId')
  @ApiOperation({ summary: 'ITN-07: delete a day and renumber remaining' })
  @ApiOkResponse({ description: 'Day deleted' })
  deleteDay(@CurrentUser() user: UserDocument, @Param('id') id: string, @Param('dayId') dayId: string) {
    return this.service.deleteDay(user._id.toString(), id, dayId);
  }

  @Patch(':id/days/:dayId/reorder')
  @ApiOperation({ summary: 'ITN-08: move a day to a new position and renumber' })
  @ApiOkResponse({ description: 'Day reordered' })
  reorderDay(
    @CurrentUser() user: UserDocument, 
    @Param('id') id: string, 
    @Param('dayId') dayId: string, 
    @Body() dto: ReorderDayDto
  ) {
    return this.service.reorderDay(user._id.toString(), id, dayId, dto.newDayNumber);
  }
}
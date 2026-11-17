import { 
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
  BadRequestException, UploadedFile, UseInterceptors 
} from '@nestjs/common';
import { 
  ApiBadRequestResponse, ApiCookieAuth, ApiCreatedResponse, ApiNotFoundResponse, 
  ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiBody, ApiConsumes 
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { CreateItineraryDayDto } from './dto/create-itinerary-day.dto';
import { UpdateItineraryDayDto } from './dto/update-itinerary-day.dto';
import { ReorderDayDto } from './dto/reorder-day.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { SearchItineraryFlightsDto } from './dto/search-itinerary-flights.dto';
import { SearchItineraryHotelsDto } from './dto/search-itinerary-hotels.dto';

// 1. Setup the upload options FIRST
const ACTIVITY_IMG_DIR = join(process.cwd(), 'uploads', 'activities');
const activityImageUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(ACTIVITY_IMG_DIR, { recursive: true });
      cb(null, ACTIVITY_IMG_DIR);
    },
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${file.mimetype === 'image/png' ? '.png' : '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // GEN-08: max 5MB
  fileFilter: (_req, file, cb) =>
    ['image/jpeg', 'image/png'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new BadRequestException('Only JPG or PNG images are allowed'), false),
};

// 2. THEN put the decorators immediately above the class
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

  // --- Phase 3 Endpoints ---
  @Post(':id/days/:dayId/activities')
  @ApiOperation({ summary: 'ITN-10: add an activity to a day' })
  @ApiCreatedResponse({ description: 'Activity added' })
  addActivity(
    @CurrentUser() user: UserDocument, 
    @Param('id') id: string, 
    @Param('dayId') dayId: string, 
    @Body() dto: CreateActivityDto
  ) {
    return this.service.addActivity(user._id.toString(), id, dayId, dto);
  }

  @Patch(':id/days/:dayId/activities/:activityId')
  @ApiOperation({ summary: 'ITN-10: edit an activity' })
  @ApiOkResponse({ description: 'Activity updated' })
  updateActivity(
    @CurrentUser() user: UserDocument, 
    @Param('id') id: string, 
    @Param('dayId') dayId: string, 
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto
  ) {
    return this.service.updateActivity(user._id.toString(), id, dayId, activityId, dto);
  }

  @Delete(':id/days/:dayId/activities/:activityId')
  @ApiOperation({ summary: 'ITN-10: delete an activity' })
  @ApiOkResponse({ description: 'Activity deleted' })
  deleteActivity(
    @CurrentUser() user: UserDocument, 
    @Param('id') id: string, 
    @Param('dayId') dayId: string, 
    @Param('activityId') activityId: string
  ) {
    return this.service.deleteActivity(user._id.toString(), id, dayId, activityId);
  }

  // --- ITN-12: Image Endpoints ---
  @Post(':id/days/:dayId/activities/:activityId/images')
  @ApiOperation({ summary: 'ITN-12: upload an image to an activity (JPG/PNG, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', activityImageUploadOptions))
  uploadActivityImage(
    @CurrentUser() user: UserDocument, 
    @Param('id') id: string, 
    @Param('dayId') dayId: string, 
    @Param('activityId') activityId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('No image provided');
    const imageUrl = `/uploads/activities/${file.filename}`;
    return this.service.addImageToActivity(user._id.toString(), id, dayId, activityId, imageUrl);
  }

  @Delete(':id/days/:dayId/activities/:activityId/images')
  @ApiOperation({ summary: 'ITN-12: remove an image from an activity' })
  @ApiOkResponse({ description: 'Image removed' })
  removeActivityImage(
    @CurrentUser() user: UserDocument, 
    @Param('id') id: string, 
    @Param('dayId') dayId: string, 
    @Param('activityId') activityId: string,
    @Body('imageUrl') imageUrl: string
  ) {
    return this.service.removeImageFromActivity(user._id.toString(), id, dayId, activityId, imageUrl);
  }

    // --- Phase 4: Integration Endpoints ---

  @Get(':id/flights')
  @ApiOperation({ summary: 'ITN-26: search flights from itinerary day 1 city (one-way or round-trip)' })
  @ApiOkResponse({ description: 'Flights found' })
  searchFlights(@CurrentUser() user: UserDocument, @Param('id') id: string, @Query() dto: SearchItineraryFlightsDto) {
    return this.service.searchItineraryFlights(user._id.toString(), id, dto);
  }

  @Get(':id/hotels')
  @ApiOperation({ summary: 'ITN-25: search hotels for a specific city group in the itinerary' })
  @ApiOkResponse({ description: 'Hotels found' })
  searchHotels(@CurrentUser() user: UserDocument, @Param('id') id: string, @Query() dto: SearchItineraryHotelsDto) {
    return this.service.searchItineraryHotels(user._id.toString(), id, dto);
  }
}
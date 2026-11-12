import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { CreateCabinDto } from './dto/create-cabin.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { ListAirlinesDto } from './dto/list-airlines.dto';
import { ListAirportsDto } from './dto/list-airports.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { BaggagePolicyDto, CancellationPolicyDto } from './dto/update-policies.dto';
import type { AuthUser } from './flights.service';
import { FlightsService } from './flights.service';

// GEN-08: logo = JPG/PNG, max 5 MB, 1 per airline.
// TODO: switch to the shared UploadsModule (Member 7) / image-upload.validator (Member 1) once merged.
const LOGO_DIR = join(process.cwd(), 'uploads', 'airlines');
const logoUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(LOGO_DIR, { recursive: true });
      cb(null, LOGO_DIR);
    },
    // random name + extension from the MIME type: the client's file name is never used
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${file.mimetype === 'image/png' ? '.png' : '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ['image/jpeg', 'image/png'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new BadRequestException('Only JPG or PNG images are allowed'), false),
};

// Roles are enforced by the global RolesGuard (Member 1): no @UseGuards needed here.
// Ownership ("only your own airline") is checked in FlightsService.
@ApiTags('Flights')
@ApiCookieAuth('access_token')
@Controller() // the 'api' prefix is set globally in main.ts
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  // ---------------- FLT-02 Airports ----------------
  @Public()
  @Get('airports')
  @ApiOperation({ summary: 'FLT-02: list airports (read-only), filter by search / countryCode / cityId' })
  listAirports(@Query() dto: ListAirportsDto) {
    return this.flightsService.listAirports(dto);
  }

  // ---------------- FLT-01 / FLT-08 / FLT-09 Airlines ----------------
  @Post('airlines')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'FLT-01: admin creates an airline profile' })
  createAirline(@Body() dto: CreateAirlineDto) {
    return this.flightsService.createAirline(dto);
  }

  @Public()
  @Get('airlines')
  @ApiOperation({ summary: 'List active airlines (extra endpoint: search filter, admin moderator form)' })
  listAirlines(@Query() dto: ListAirlinesDto) {
    return this.flightsService.listAirlines(dto);
  }

  @Public()
  @Get('airlines/:id')
  @ApiOperation({ summary: 'FLT-01: get an airline (profile, baggage and cancellation policy)' })
  getAirline(@Param('id') id: string) {
    return this.flightsService.getAirline(id);
  }

  @Patch('airlines/:id')
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-01: edit airline name / code (moderator: own airline only)' })
  updateAirline(@Param('id') id: string, @Body() dto: UpdateAirlineDto, @CurrentUser() user: AuthUser) {
    return this.flightsService.updateAirline(id, dto, user);
  }

  @Post('airlines/:id/logo')
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-01 + GEN-08: upload the airline logo (JPG/PNG, max 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', logoUploadOptions))
  uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flightsService.setLogo(id, file, user);
  }

  @Put('airlines/:id/baggage-policy')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-08: extra-bag price and max extra bags per passenger (own airline)' })
  updateBaggagePolicy(@Param('id') id: string, @Body() dto: BaggagePolicyDto, @CurrentUser() user: AuthUser) {
    return this.flightsService.updateBaggagePolicy(id, dto, user);
  }

  @Put('airlines/:id/cancellation-policy')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-09: cancellation tiers (days before departure -> refund %) (own airline)' })
  updateCancellationPolicy(
    @Param('id') id: string,
    @Body() dto: CancellationPolicyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flightsService.updateCancellationPolicy(id, dto, user);
  }

  // ---------------- FLT-03 / FLT-05 / FLT-06 Flights ----------------
  @Post('flights')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-03: create a flight (times are LOCAL to each airport, stored as UTC)' })
  createFlight(@Body() dto: CreateFlightDto, @CurrentUser() user: AuthUser) {
    return this.flightsService.createFlight(dto, user);
  }

  // NOTE: must stay above flights/:id
  @Public()
  @Get('flights/search')
  @ApiOperation({
    summary: 'FLT-11/12/15: search flights (one-way or round-trip), filter by price / cabin, sort, paginate',
  })
  search(@Query() dto: SearchFlightsDto) {
    return this.flightsService.searchFlights(dto);
  }

  @Public()
  @Get('flights/:id')
  @ApiOperation({ summary: 'FLT-17: flight details (local times, cabins, baggage, cancellation policy)' })
  getFlightById(@Param('id') id: string) {
    return this.flightsService.getFlightById(id);
  }

  @Patch('flights/:id')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-05: edit times (and airports while there are no bookings) of a Scheduled flight' })
  updateFlight(@Param('id') id: string, @Body() dto: UpdateFlightDto, @CurrentUser() user: AuthUser) {
    return this.flightsService.updateFlight(id, dto, user);
  }

  @Post('flights/:id/cancel')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-06: cancel a Scheduled flight (bookings are cancelled + refunded by the bookings module)' })
  cancelFlight(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.flightsService.cancelFlight(id, user);
  }

  // ---------------- FLT-04 / FLT-05 Cabins ----------------
  @Post('flights/:id/cabins')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-04: add a cabin category (seats, price, free bags, max kg per bag)' })
  addCabin(@Param('id') flightId: string, @Body() dto: CreateCabinDto, @CurrentUser() user: AuthUser) {
    return this.flightsService.addCabin(flightId, dto, user);
  }

  @Patch('flights/:id/cabins/:cabinId')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-05: change cabin price and/or seat count (never below held + booked)' })
  updateCabin(
    @Param('id') flightId: string,
    @Param('cabinId') cabinId: string,
    @Body() dto: UpdateCabinDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flightsService.updateCabin(flightId, cabinId, dto, user);
  }

  // ---------------- FLT-29 Bookings / passenger export ----------------
  @Get('flights/:id/bookings')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-29: bookings of a flight + seats remaining per cabin (own airline)' })
  getFlightBookings(@Param('id') id: string, @Query() p: PaginationDto, @CurrentUser() user: AuthUser) {
    return this.flightsService.getFlightBookings(id, user, p);
  }

  @Get('flights/:id/passengers/export')
  @Roles(Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-29: download the passenger list as CSV (own airline)' })
  @ApiProduces('text/csv') // Swagger UI then shows a "Download file" link
  @ApiOkResponse({ description: 'CSV file: Booking Reference, Passenger Name, Cabin, Seats, Status' })
  async exportPassengers(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.flightsService.exportPassengersCsv(id, user);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="flight-${id}-passengers.csv"`,
    });
    return csv;
  }
}

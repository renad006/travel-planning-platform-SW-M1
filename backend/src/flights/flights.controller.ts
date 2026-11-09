import { Controller, Get, Post, Body, Patch, Put, Param, UseGuards, Query, Res, Header } from '@nestjs/common';
import type { Response } from 'express';
import { FlightsService } from './flights.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { CreateCabinDto } from './dto/create-cabin.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { BaggagePolicyDto, CancellationPolicyDto } from './dto/update-policies.dto';

@Controller() // NO 'api' here, the app.module handles it
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  // ==========================================
  // AIRLINES (FLT-01, FLT-08, FLT-09)
  // ==========================================
  @Post('airlines')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async createAirline(@Body() dto: CreateAirlineDto) {
    return this.flightsService.createAirline(dto);
  }

  @Public()
  @Get('airlines/:id')
  async getAirline(@Param('id') id: string) {
    return this.flightsService.getAirline(id);
  }

  @Patch('airlines/:id') // <--- ADDED HERE
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async updateAirline(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.flightsService.updateAirline(id, dto, user);
  }

  @Put('airlines/:id/baggage-policy')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async updateBaggagePolicy(
    @Param('id') id: string,
    @Body() dto: BaggagePolicyDto,
    @CurrentUser() user: any,
  ) {
    return this.flightsService.updateBaggagePolicy(id, dto, user);
  }

  @Put('airlines/:id/cancellation-policy')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async updateCancellationPolicy(
    @Param('id') id: string,
    @Body() dto: CancellationPolicyDto,
    @CurrentUser() user: any,
  ) {
    return this.flightsService.updateCancellationPolicy(id, dto, user);
  }

  // ==========================================
  // FLIGHTS (FLT-03, FLT-05, FLT-06, FLT-17)
  // ==========================================
  @Post('flights')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async createFlight(@Body() dto: CreateFlightDto, @CurrentUser() user: any) {
    return this.flightsService.createFlight(dto, user);
  }

  @Public()
  @Get('flights/search')
  async search(@Query() dto: SearchFlightsDto) {
    return this.flightsService.searchFlights(dto);
  }

  @Public()
  @Get('flights/:id')
  async getFlightById(@Param('id') id: string) {
    return this.flightsService.getFlightById(id);
  }

  @Patch('flights/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async updateFlight(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.flightsService.updateFlight(id, dto, user);
  }

  @Post('flights/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async cancelFlight(@Param('id') id: string, @CurrentUser() user: any) {
    return this.flightsService.cancelFlight(id, user);
  }

  // ==========================================
  // CABINS (FLT-04)
  // ==========================================
  @Post('flights/:id/cabins')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async addCabin(
    @Param('id') flightId: string,
    @Body() dto: CreateCabinDto,
    @CurrentUser() user: any,
  ) {
    return this.flightsService.addCabin(flightId, dto, user);
  }

  @Patch('flights/:id/cabins/:cabinClass')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async updateCabin(
    @Param('id') flightId: string,
    @Param('cabinClass') cabinClass: string,
    @Body() dto: UpdateCabinDto,
    @CurrentUser() user: any,
  ) {
    return this.flightsService.updateCabinSeats(flightId, cabinClass, dto.totalSeats, user);
  }

  // ==========================================
  // EXPORT (FLT-29)
  // ==========================================
  @Get('flights/:id/bookings')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  async getFlightBookings(@Param('id') id: string) {
    return [
      { bookingId: '1', passenger: 'John Doe', status: 'Confirmed' },
      { bookingId: '2', passenger: 'Jane Smith', status: 'Confirmed' },
    ];
  }

  @Get('flights/:id/passengers/export')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AIRLINE_MODERATOR)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="passengers.csv"')
  async exportPassengers(@Param('id') id: string, @Res() res: Response) {
    const csvData = await this.flightsService.exportPassengersCsv(id);
    return res.status(200).send(csvData);
  }
}
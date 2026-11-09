import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Airline, AirlineDocument } from './schemas/airline.schema';
import { Flight, FlightDocument, FlightStatus } from './schemas/flight.schema';
import { CabinInventory, CabinInventoryDocument } from './schemas/cabin-inventory.schema';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { Role } from '../common/enums/role.enum'; 
import { Airport, AirportDocument } from '../reference-data/schemas/airport.schema';

@Injectable()
export class FlightsService {
  constructor(
    @InjectModel(Airline.name) private airlineModel: Model<AirlineDocument>,
    @InjectModel(Flight.name) private flightModel: Model<FlightDocument>,
    @InjectModel(CabinInventory.name) private cabinModel: Model<CabinInventoryDocument>,
    @InjectModel(Airport.name) private airportModel: Model<AirportDocument>, 
  ) {}

  // --- FLT-17: Time Zone Helper ---
  private formatToLocal(date: Date, timeZone: string): string {
    if (!timeZone) return date.toISOString();
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  }

  // ==========================================
  // AIRLINES
  // ==========================================
  
  // --- FLT-01: Airline Management ---
  async createAirline(dto: any) {
    return this.airlineModel.create(dto);
  }

  async getAirline(id: string) {
    return this.airlineModel.findById(id);
  }

  // --- FLT-01: Update Airline Profile ---
  async updateAirline(id: string, dto: any, user: any) {
    const airline = await this.airlineModel.findById(id);
    if (!airline) throw new NotFoundException('Airline not found');

    if ((user.role === Role.AIRLINE_MODERATOR || user.role === 'AIRLINE_MODERATOR') && 
        user.assignedProviderId?.toString() !== airline._id.toString()) {
      throw new ForbiddenException('You do not own this airline');
    }

    Object.assign(airline, dto);
    return airline.save();
  }

  // --- FLT-08: Update Baggage Policy ---
  async updateBaggagePolicy(id: string, dto: any, user: any) {
    const airline = await this.airlineModel.findById(id);
    if (!airline) throw new NotFoundException('Airline not found');

    if ((user.role === Role.AIRLINE_MODERATOR || user.role === 'AIRLINE_MODERATOR') && 
        user.assignedProviderId?.toString() !== airline._id.toString()) {
      throw new ForbiddenException('You do not own this airline');
    }

    airline.baggagePolicy = dto;
    return airline.save();
  }

  // --- FLT-09: Update Cancellation Policy ---
  async updateCancellationPolicy(id: string, dto: any, user: any) {
    const airline = await this.airlineModel.findById(id);
    if (!airline) throw new NotFoundException('Airline not found');

    if ((user.role === Role.AIRLINE_MODERATOR || user.role === 'AIRLINE_MODERATOR') && 
        user.assignedProviderId?.toString() !== airline._id.toString()) {
      throw new ForbiddenException('You do not own this airline');
    }

    airline.cancellationPolicy = dto.rules;
    return airline.save();
  }

  // ==========================================
  // FLIGHTS
  // ==========================================

  // --- FLT-03: Create Flight ---
  async createFlight(dto: any, user: any) {
    if (user.role === Role.AIRLINE_MODERATOR || user.role === 'AIRLINE_MODERATOR') {
      dto.airlineId = user.assignedProviderId;
    }
    return this.flightModel.create(dto);
  }

  // --- FLT-17: Get Flight by ID (with local times) ---
  async getFlightById(id: string) {
    const flight = await this.flightModel.findById(id).populate('airlineId');
    if (!flight) throw new NotFoundException('Flight not found');

    const originAirport = await this.airportModel.findOne({ iataCode: flight.originAirport });
    const destAirport = await this.airportModel.findOne({ iataCode: flight.destinationAirport });

    const flightData: any = flight.toObject();

    if (originAirport) {
      flightData.departureTimeLocal = this.formatToLocal(flight.departureTime, originAirport.timeZone);
    }
    if (destAirport) {
      flightData.arrivalTimeLocal = this.formatToLocal(flight.arrivalTime, destAirport.timeZone);
    }

    return flightData;
  }

  // --- FLT-05: Update Flight Schedule ---
  async updateFlight(id: string, dto: any, user: any) {
    const flight = await this.flightModel.findById(id);
    if (!flight) throw new NotFoundException('Flight not found');

    if ((user.role === Role.AIRLINE_MODERATOR || user.role === 'AIRLINE_MODERATOR') && 
        user.assignedProviderId?.toString() !== flight.airlineId.toString()) {
      throw new ForbiddenException('You do not own this airline');
    }

    Object.assign(flight, dto);
    return flight.save();
  }

  // --- FLT-06: Cancel Flight ---
  async cancelFlight(id: string, user: any) {
    const flight = await this.flightModel.findById(id);
    if (!flight) throw new NotFoundException('Flight not found');

    if ((user.role === Role.AIRLINE_MODERATOR || user.role === 'AIRLINE_MODERATOR') && 
        user.assignedProviderId?.toString() !== flight.airlineId.toString()) {
      throw new ForbiddenException('You do not own this airline');
    }

    flight.status = FlightStatus.CANCELLED;
    return flight.save();
  }

  // ==========================================
  // CABINS (FLT-04)
  // ==========================================
  
  async addCabin(flightId: string, dto: any, user: any) {
    const flight = await this.flightModel.findById(flightId);
    if (!flight) throw new NotFoundException('Flight not found');

    if ((user.role === Role.AIRLINE_MODERATOR || user.role === 'AIRLINE_MODERATOR') && 
        user.assignedProviderId?.toString() !== flight.airlineId.toString()) {
      throw new ForbiddenException('You do not own this airline');
    }

    return this.cabinModel.create({
      flightId: new Types.ObjectId(flightId),
      cabinClass: dto.cabinClass,
      totalSeats: dto.totalSeats,
      price: dto.price,
      heldSeats: 0,
      bookedSeats: 0,
    });
  }

  async updateCabinSeats(flightId: string, cabinClass: string, newTotalSeats: number, user: any) {
    if (newTotalSeats === undefined || newTotalSeats === null || isNaN(newTotalSeats)) {
      throw new BadRequestException('totalSeats must be a valid number.');
    }

    const flight = await this.flightModel.findById(flightId);
    if (!flight) throw new NotFoundException('Flight not found');
    
    if ((user.role === Role.AIRLINE_MODERATOR || user.role === 'AIRLINE_MODERATOR') && 
        user.assignedProviderId?.toString() !== flight.airlineId.toString()) {
      throw new ForbiddenException('You do not own this airline');
    }

    const cabin = await this.cabinModel.findOneAndUpdate(
      {
        flightId: new Types.ObjectId(flightId),
        cabinClass,
        $expr: { $gte: [newTotalSeats, { $add: ['$heldSeats', '$bookedSeats'] }] }
      },
      { $set: { totalSeats: newTotalSeats } },
      { new: true }
    );

    if (!cabin) {
      throw new BadRequestException('Cannot reduce seats below already held/booked seats, or cabin not found.');
    }
    return cabin;
  }

  // ==========================================
  // SEARCH (FLT-11, FLT-12, FLT-15, FLT-17)
  // ==========================================
  async searchFlights(dto: SearchFlightsDto) {
    const requestedSeats = (dto.adults || 1) + (dto.children || 0);
    
    const match: any = {
      status: FlightStatus.SCHEDULED,
    };
    if (dto.origin) match.originAirport = dto.origin.toUpperCase();
    if (dto.destination) match.destinationAirport = dto.destination.toUpperCase();
    if (dto.airlineId) match.airlineId = new Types.ObjectId(dto.airlineId);
    
    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: 'airlines',
          localField: 'airlineId',
          foreignField: '_id',
          as: 'airline',
        },
      },
      { $unwind: '$airline' },
      { $match: { 'airline.isActive': true } }, 
      {
        $lookup: {
          from: 'cabin_inventories', 
          let: { fId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$flightId', '$$fId'] },
                    { $eq: ['$cabinClass', dto.cabinClass || 'Economy'] },
                    { $gte: [{ $subtract: ['$totalSeats', { $add: ['$heldSeats', '$bookedSeats'] }] }, requestedSeats] }
                  ]
                }
              }
            }
          ],
          as: 'cabinData',
        },
      },
      { $match: { 'cabinData.0': { $exists: true } } },
      { $unwind: '$cabinData' },
    ];

    if (dto.maxPrice) {
      pipeline.push({ $match: { 'cabinData.price': { $lte: dto.maxPrice } } });
    }

    if (dto.sortBy === 'price') {
      pipeline.push({ $sort: { 'cabinData.price': 1 } });
    } else if (dto.sortBy === 'duration') {
      pipeline.push({ $addFields: { duration: { $subtract: ['$arrivalTime', '$departureTime'] } } });
      pipeline.push({ $sort: { duration: 1 } });
    } else {
      pipeline.push({ $sort: { departureTime: 1 } });
    }

    const page = dto.page || 1;
    const limit = dto.limit || 10;
    const skip = (page - 1) * limit;
    
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const results = await this.flightModel.aggregate(pipeline);

    // --- FLT-17: Enrich search results with local time zones ---
    const airportCodes = new Set<string>();
    results.forEach((r) => {
      airportCodes.add(r.originAirport);
      airportCodes.add(r.destinationAirport);
    });

    const airports = await this.airportModel.find({ 
      iataCode: { $in: Array.from(airportCodes) } 
    });

    const timeZoneMap: Record<string, string> = {};
    airports.forEach((a) => { timeZoneMap[a.iataCode] = a.timeZone; });

    return results.map((flight) => {
      if (timeZoneMap[flight.originAirport]) {
        flight.departureTimeLocal = this.formatToLocal(flight.departureTime, timeZoneMap[flight.originAirport]);
      }
      if (timeZoneMap[flight.destinationAirport]) {
        flight.arrivalTimeLocal = this.formatToLocal(flight.arrivalTime, timeZoneMap[flight.destinationAirport]);
      }
      return flight;
    });
  }

  // ==========================================
  // PASSENGER EXPORT (FLT-29)
  // ==========================================
  async exportPassengersCsv(flightId: string): Promise<string> {
    const mockBookings = [
      { passengerName: 'John Doe', seat: '12A', bookingRef: 'ABC123', status: 'Confirmed' },
      { passengerName: 'Jane Smith', seat: '12B', bookingRef: 'DEF456', status: 'Confirmed' },
    ];

    let csv = 'Passenger Name,Seat,Booking Reference,Status\n';

    mockBookings.forEach((b) => {
      csv += `"${b.passengerName}","${b.seat}","${b.bookingRef}","${b.status}"\n`;
    });

    return csv;
  }
}
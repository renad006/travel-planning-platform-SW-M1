import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Itinerary, ItineraryDocument, ItineraryDay, Activity } from './schemas/itinerary.schema';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { CreateItineraryDayDto } from './dto/create-itinerary-day.dto';
import { UpdateItineraryDayDto } from './dto/update-itinerary-day.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { FlightsService } from '../flights/flights.service';
import { HotelsService } from '../hotels/hotels.service';
import { City, CityDocument } from '../reference-data/schemas/city.schema';
import { Airport, AirportDocument } from '../reference-data/schemas/airport.schema';
import { SearchFlightsDto, FlightSortBy, SortOrder } from '../flights/dto/search-flights.dto';
import { SearchHotelsQueryDto } from '../hotels/dto/search-hotels-query.dto';
import { SearchItineraryFlightsDto } from './dto/search-itinerary-flights.dto';
import { SearchItineraryHotelsDto } from './dto/search-itinerary-hotels.dto';

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectModel(Itinerary.name) private readonly itineraryModel: Model<ItineraryDocument>,
    @InjectModel(City.name) private readonly cityModel: Model<CityDocument>,
    @InjectModel(Airport.name) private readonly airportModel: Model<AirportDocument>,
    private readonly flightsService: FlightsService,
    private readonly hotelsService: HotelsService,
  ) {}
  // --- Phase 1: Itinerary CRUD ---
  async create(userId: string, dto: CreateItineraryDto) {
    const doc = await this.itineraryModel.create({
      userId: new Types.ObjectId(userId),
      title: dto.title,
      countries: dto.countries,
      startDate: new Date(dto.startDate),
      visibility: 'private',
      days: [],
    });
    return this.toDetail(doc);
  }

  async findAllMine(userId: string) {
    const items = await this.itineraryModel.find({ userId: new Types.ObjectId(userId) }).sort({ updatedAt: -1 }).exec();
    return items.map((doc) => this.toSummary(doc));
  }

  async findMine(userId: string, id: string) {
    const doc = await this.getOwnedDoc(userId, id);
    return this.toDetail(doc);
  }

  async update(userId: string, id: string, dto: UpdateItineraryDto) {
    const doc = await this.getOwnedDoc(userId, id);
    if (dto.title !== undefined) doc.title = dto.title;
    if (dto.countries !== undefined) doc.countries = dto.countries;
    if (dto.startDate !== undefined) doc.startDate = new Date(dto.startDate);
    await doc.save();
    return this.toDetail(doc);
  }

  async remove(userId: string, id: string) {
    const doc = await this.getOwnedDoc(userId, id);
    await doc.deleteOne();
    return { deleted: true, id };
  }

  // --- Phase 2: Days Logic ---
  async addDay(userId: string, itineraryId: string, dto: CreateItineraryDayDto) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    if (doc.days.length >= 60) {
      throw new BadRequestException('Itinerary cannot exceed 60 days');
    }
    const newDay: ItineraryDay = {
      _id: new Types.ObjectId(),
      dayNumber: doc.days.length + 1,
      city: dto.city,
      notes: dto.notes,
      activities: [],
      budgetEntries: [],
      transportCosts: [],
    };
    doc.days.push(newDay);
    await doc.save();
    return this.toDetail(doc);
  }

  async updateDay(userId: string, itineraryId: string, dayId: string, dto: UpdateItineraryDayDto) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    const day = doc.days.find((d) => d._id.toString() === dayId);
    if (!day) throw new NotFoundException('Day not found');
    
    if (dto.city !== undefined) day.city = dto.city;
    if (dto.notes !== undefined) day.notes = dto.notes;
    
    await doc.save();
    return this.toDetail(doc);
  }

  async deleteDay(userId: string, itineraryId: string, dayId: string) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    const initialLength = doc.days.length;
    
    doc.days = doc.days.filter((d) => d._id.toString() !== dayId);
    if (doc.days.length === initialLength) throw new NotFoundException('Day not found');
    
    // Renumber remaining days
    doc.days.forEach((d, index) => { d.dayNumber = index + 1; });
    await doc.save();
    return this.toDetail(doc);
  }

  async reorderDay(userId: string, itineraryId: string, dayId: string, newPosition: number) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    
    const currentIndex = doc.days.findIndex((d) => d._id.toString() === dayId);
    if (currentIndex === -1) throw new NotFoundException('Day not found');
    if (newPosition > doc.days.length || newPosition < 1) {
      throw new BadRequestException(`newDayNumber must be between 1 and ${doc.days.length}`);
    }

    // Remove the day and insert it at the new position
    const [dayToMove] = doc.days.splice(currentIndex, 1);
    doc.days.splice(newPosition - 1, 0, dayToMove);

    // Renumber all days
    doc.days.forEach((d, index) => { d.dayNumber = index + 1; });

    await doc.save();
    return this.toDetail(doc);
  }

  // --- Phase 3: Activities Logic ---
  async addActivity(userId: string, itineraryId: string, dayId: string, dto: CreateActivityDto) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    const day = doc.days.find((d) => d._id.toString() === dayId);
    if (!day) throw new NotFoundException('Day not found');

    const newActivity: Activity = {
      _id: new Types.ObjectId(),
      name: dto.name,
      description: dto.description,
      time: dto.time,
      cost: dto.cost,
      currency: dto.currency,
      images: [],
    };

    day.activities.push(newActivity);
    await doc.save();
    return this.toDetail(doc);
  }

  async updateActivity(userId: string, itineraryId: string, dayId: string, activityId: string, dto: UpdateActivityDto) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    const day = doc.days.find((d) => d._id.toString() === dayId);
    if (!day) throw new NotFoundException('Day not found');

    const activity = day.activities.find((a) => a._id.toString() === activityId);
    if (!activity) throw new NotFoundException('Activity not found');

    if (dto.name !== undefined) activity.name = dto.name;
    if (dto.description !== undefined) activity.description = dto.description;
    if (dto.time !== undefined) activity.time = dto.time;
    if (dto.cost !== undefined) activity.cost = dto.cost;
    if (dto.currency !== undefined) activity.currency = dto.currency;

    await doc.save();
    return this.toDetail(doc);
  }

  async deleteActivity(userId: string, itineraryId: string, dayId: string, activityId: string) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    const day = doc.days.find((d) => d._id.toString() === dayId);
    if (!day) throw new NotFoundException('Day not found');

    const initialLength = day.activities.length;
    day.activities = day.activities.filter((a) => a._id.toString() !== activityId);
    
    if (day.activities.length === initialLength) throw new NotFoundException('Activity not found');
    
    await doc.save();
    return this.toDetail(doc);
  }

  // --- ITN-12: Image Logic ---
  async addImageToActivity(userId: string, itineraryId: string, dayId: string, activityId: string, imageUrl: string) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    const day = doc.days.find((d) => d._id.toString() === dayId);
    if (!day) throw new NotFoundException('Day not found');

    const activity = day.activities.find((a) => a._id.toString() === activityId);
    if (!activity) throw new NotFoundException('Activity not found');

    activity.images.push(imageUrl);
    await doc.save();
    return this.toDetail(doc);
  }

  async removeImageFromActivity(userId: string, itineraryId: string, dayId: string, activityId: string, imageUrl: string) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    const day = doc.days.find((d) => d._id.toString() === dayId);
    if (!day) throw new NotFoundException('Day not found');

    const activity = day.activities.find((a) => a._id.toString() === activityId);
    if (!activity) throw new NotFoundException('Activity not found');

    activity.images = activity.images.filter((img) => img !== imageUrl);
    await doc.save();
    return this.toDetail(doc);
  }

    // --- Phase 4: Integration Endpoints ---

  async searchItineraryFlights(userId: string, itineraryId: string, dto: SearchItineraryFlightsDto) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    if (!doc.days.length) throw new BadRequestException('Itinerary has no days to search flights for');

    const firstDay = doc.days[0];
    const lastDay = doc.days[doc.days.length - 1];

    // 1. Find the city in the database to get its airport
    const city = await this.cityModel.findOne({ name: new RegExp(`^${firstDay.city}$`, 'i') }).lean();
    if (!city) throw new NotFoundException(`City ${firstDay.city} not found in reference data`);

    // Find the first airport in that city
    const airport = await this.airportModel.findOne({ cityId: city.cityId }).lean();
    if (!airport) throw new NotFoundException(`No airport found for city ${firstDay.city}`);

    // 2. Calculate dates
    const start = new Date(doc.startDate).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const departureDate = new Date(start).toISOString().split('T')[0];
    const returnDate = doc.days.length > 1 ? new Date(start + (lastDay.dayNumber - 1) * oneDayMs).toISOString().split('T')[0] : undefined;

    // 3. Build the DTO for Member 2's service
    const searchDto: SearchFlightsDto = {
      origin: dto.origin,
      destination: airport.iataCode,
      departureDate,
      returnDate,
      adults: dto.adults,
      children: dto.children,
      infants: dto.infants,
      page: 1,
      limit: 10,
      sortBy: FlightSortBy.PRICE,
      sortOrder: SortOrder.ASC,
    };

    return this.flightsService.searchFlights(searchDto);
  }

  async searchItineraryHotels(userId: string, itineraryId: string, dto: SearchItineraryHotelsDto) {
    const doc = await this.getOwnedDoc(userId, itineraryId);
    const dayIndex = doc.days.findIndex(d => d._id.toString() === dto.dayId);
    if (dayIndex === -1) throw new NotFoundException('Day not found');

    const cityName = doc.days[dayIndex].city;
    
    // Find the contiguous group of days for this city
    let startIndex = dayIndex;
    while (startIndex > 0 && doc.days[startIndex - 1].city === cityName) startIndex--;
    let endIndex = dayIndex;
    while (endIndex < doc.days.length - 1 && doc.days[endIndex + 1].city === cityName) endIndex++;

    // Calculate check-in and check-out dates
    const start = new Date(doc.startDate).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const checkIn = new Date(start + (doc.days[startIndex].dayNumber - 1) * oneDayMs).toISOString().split('T')[0];
    const checkOut = new Date(start + (doc.days[endIndex].dayNumber) * oneDayMs).toISOString().split('T')[0];

    // Find the city in the database
    const city = await this.cityModel.findOne({ name: new RegExp(`^${cityName}$`, 'i') }).lean();
    if (!city) throw new NotFoundException(`City ${cityName} not found in reference data`);

    // Build the DTO for Member 4's service
    const searchDto: SearchHotelsQueryDto = {
      cityId: city.cityId,
      checkIn,
      checkOut,
      guests: dto.guests,
      rooms: dto.rooms || 1,
      page: 1,
      limit: 10,
      sortOrder: 'asc',
    };

    return this.hotelsService.search(searchDto);
  }

  // --- Helpers ---
  private async getOwnedDoc(userId: string, id: string): Promise<ItineraryDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Itinerary not found');
    const doc = await this.itineraryModel.findById(id).exec();
    if (!doc || doc.userId.toString() !== userId) throw new NotFoundException('Itinerary not found');
    return doc;
  }

  private calculateDates(doc: ItineraryDocument) {
    const start = new Date(doc.startDate).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    return doc.days.map((day) => ({
      ...(day as any).toObject(),
      date: new Date(start + (day.dayNumber - 1) * oneDayMs).toISOString().split('T')[0],
    }));
  }

  private toSummary(doc: ItineraryDocument) {
    return {
      id: doc._id.toString(),
      title: doc.title,
      countries: doc.countries,
      startDate: doc.startDate,
      visibility: doc.visibility,
      daysCount: doc.days.length,
      updatedAt: (doc as any).updatedAt,
      createdAt: (doc as any).createdAt,
    };
  }

  private toDetail(doc: ItineraryDocument) {
    return {
      id: doc._id.toString(),
      title: doc.title,
      countries: doc.countries,
      startDate: doc.startDate,
      visibility: doc.visibility,
      daysCount: doc.days.length,
      days: this.calculateDates(doc),
      originalAuthorId: doc.originalAuthorId?.toString() ?? null,
      originalItineraryId: doc.originalItineraryId?.toString() ?? null,
      updatedAt: (doc as any).updatedAt,
      createdAt: (doc as any).createdAt,
    };
  }
}
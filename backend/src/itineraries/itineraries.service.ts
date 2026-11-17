import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Itinerary, ItineraryDocument, ItineraryDay } from './schemas/itinerary.schema';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { CreateItineraryDayDto } from './dto/create-itinerary-day.dto';
import { UpdateItineraryDayDto } from './dto/update-itinerary-day.dto';

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectModel(Itinerary.name) private readonly itineraryModel: Model<ItineraryDocument>,
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
      ...(day as any).toObject(), // <--- The fix is here
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
      days: this.calculateDates(doc), // Now using calculateDates!
      originalAuthorId: doc.originalAuthorId?.toString() ?? null,
      originalItineraryId: doc.originalItineraryId?.toString() ?? null,
      updatedAt: (doc as any).updatedAt,
      createdAt: (doc as any).createdAt,
    };
  }
}
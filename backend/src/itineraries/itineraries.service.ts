import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Itinerary, ItineraryDocument } from './schemas/itinerary.schema';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectModel(Itinerary.name) private readonly itineraryModel: Model<ItineraryDocument>,
  ) {}

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

  private async getOwnedDoc(userId: string, id: string): Promise<ItineraryDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Itinerary not found');
    const doc = await this.itineraryModel.findById(id).exec();
    if (!doc || doc.userId.toString() !== userId) throw new NotFoundException('Itinerary not found');
    return doc;
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
      days: doc.days,
      originalAuthorId: doc.originalAuthorId?.toString() ?? null,
      originalItineraryId: doc.originalItineraryId?.toString() ?? null,
      updatedAt: (doc as any).updatedAt,
      createdAt: (doc as any).createdAt,
    };
  }
}
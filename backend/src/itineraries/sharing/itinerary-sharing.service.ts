import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Itinerary, ItineraryDocument } from '../schemas/itinerary.schema';
import { Visibility } from './dto/set-visibility.dto';

/**
 * ITN-20 / ITN-21: sharing of itineraries (Member 3). Uses Member 6's Itinerary model and does
 * not change any of her files.
 */
@Injectable()
export class ItinerarySharingService {
  constructor(
    @InjectModel(Itinerary.name)
    private readonly itineraryModel: Model<ItineraryDocument>,
  ) {}

  /**
   * ITN-20: make an itinerary Public or Private. One atomic update of one field, owner only
   * (anyone else gets 404). Setting Private takes effect immediately because public search reads
   * this field live. `isHidden` (set by admins, GEN-10) is never touched here.
   */
  async setVisibility(userId: string, itineraryId: string, visibility: Visibility) {
    if (!Types.ObjectId.isValid(itineraryId)) {
      throw new NotFoundException('Itinerary not found');
    }
    const updated = await this.itineraryModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(itineraryId), userId: new Types.ObjectId(userId) },
        { $set: { visibility } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) throw new NotFoundException('Itinerary not found');

    return {
      id: updated._id.toString(),
      title: updated.title,
      visibility: updated.visibility,
      isHidden: updated.isHidden ?? false,
      updatedAt: (updated as unknown as { updatedAt: Date }).updatedAt,
    };
  }
}

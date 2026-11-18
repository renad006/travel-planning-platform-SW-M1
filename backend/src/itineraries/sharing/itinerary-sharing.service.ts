import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { calculateDaysSubtotal } from '../budget/budget-calculator';
import { Itinerary, ItineraryDocument } from '../schemas/itinerary.schema';
import { SearchSharedItinerariesDto } from './dto/search-shared-itineraries.dto';
import { buildItineraryClone } from './itinerary-clone';
import { Visibility } from './dto/set-visibility.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * What the public may see. An itinerary is public only if its owner made it public and an admin
 * has not hidden it (GEN-10: hidden content is visible only to its author and admins). Its author
 * must also still be an active user. `isHidden: { $ne: true }` also covers older documents that
 * do not have the field.
 */
const PUBLIC_FILTER = { visibility: 'public', isHidden: { $ne: true } } as const;

/**
 * ITN-20 / ITN-21: sharing of itineraries (Member 3). Uses Member 6's Itinerary model and does
 * not change any of her files.
 */
@Injectable()
export class ItinerarySharingService {
  constructor(
    @InjectModel(Itinerary.name)
    private readonly itineraryModel: Model<ItineraryDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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

  /**
   * ITN-21: search public itineraries. Guests and users can use it. Keyword `q` matches the title,
   * a country or a city (case-insensitive, part of a word is enough); `country` and `city` match
   * exactly; `minDays` / `maxDays` limit the number of days. Newest changes first.
   */
  async search(query: SearchSharedItinerariesDto) {
    const { q, country, city, minDays, maxDays } = query;
    if (minDays !== undefined && maxDays !== undefined && minDays > maxDays) {
      throw new BadRequestException('minDays cannot be greater than maxDays');
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const and: Record<string, unknown>[] = [];
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      and.push({ $or: [{ title: rx }, { countries: rx }, { 'days.city': rx }] });
    }
    if (country) and.push({ countries: new RegExp(`^${escapeRegex(country)}$`, 'i') });
    if (city) and.push({ 'days.city': new RegExp(`^${escapeRegex(city)}$`, 'i') });
    if (minDays !== undefined) and.push({ $expr: { $gte: [{ $size: '$days' }, minDays] } });
    if (maxDays !== undefined) and.push({ $expr: { $lte: [{ $size: '$days' }, maxDays] } });

    const [result] = await this.itineraryModel
      .aggregate<{
        items: Array<Record<string, any>>;
        total: Array<{ n: number }>;
      }>([
        { $match: { ...PUBLIC_FILTER, ...(and.length ? { $and: and } : {}) } },
        {
          $lookup: {
            from: this.userModel.collection.name,
            localField: 'userId',
            foreignField: '_id',
            as: 'author',
            pipeline: [{ $project: { name: 1, status: 1 } }],
          },
        },
        { $unwind: '$author' },
        { $match: { 'author.status': AccountStatus.ACTIVE } },
        { $sort: { updatedAt: -1, _id: -1 } },
        {
          $facet: {
            items: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              {
                $project: {
                  title: 1,
                  countries: 1,
                  startDate: 1,
                  updatedAt: 1,
                  daysCount: { $size: '$days' },
                  cities: '$days.city',
                  authorName: '$author.name',
                },
              },
            ],
            total: [{ $count: 'n' }],
          },
        },
      ])
      .exec();

    const total = result?.total[0]?.n ?? 0;
    return {
      items: (result?.items ?? []).map((i) => ({
        id: String(i._id),
        title: i.title,
        countries: i.countries,
        startDate: i.startDate,
        daysCount: i.daysCount,
        cities: [...new Set<string>(i.cities ?? [])],
        author: { name: i.authorName },
        updatedAt: i.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * ITN-21: view one public itinerary, read-only: author, days, activities and budget.
   * Private, hidden, unknown or ownerless itineraries are all a plain 404, so nothing leaks.
   * No user ids, emails or booking ids are returned.
   */
  async viewPublic(itineraryId: string) {
    if (!Types.ObjectId.isValid(itineraryId)) throw new NotFoundException('Itinerary not found');
    const doc = await this.itineraryModel
      .findOne({ _id: new Types.ObjectId(itineraryId), ...PUBLIC_FILTER })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Itinerary not found');

    const author = await this.userModel
      .findOne({ _id: doc.userId, status: AccountStatus.ACTIVE })
      .select('name')
      .lean()
      .exec();
    if (!author) throw new NotFoundException('Itinerary not found');

    const start = new Date(doc.startDate).getTime();
    const days = [...doc.days]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((d) => ({
        dayNumber: d.dayNumber,
        date: new Date(start + (d.dayNumber - 1) * DAY_MS).toISOString().split('T')[0],
        city: d.city,
        notes: d.notes ?? null,
        activities: (d.activities ?? []).map((a) => ({
          name: a.name,
          description: a.description ?? null,
          time: a.time ?? null,
          cost: a.cost ?? null,
          currency: a.currency ?? null,
          images: a.images ?? [],
        })),
        budgetEntries: (d.budgetEntries ?? []).map((e) => ({
          category: e.category,
          amount: e.amount,
          currency: e.currency,
        })),
        transportCosts: (d.transportCosts ?? []).map((t) => ({
          mode: t.mode,
          fromCity: t.fromCity,
          toCity: t.toCity,
          amount: t.amount,
          currency: t.currency,
        })),
        subtotal: calculateDaysSubtotal([d]).total,
      }));

    return {
      id: doc._id.toString(),
      title: doc.title,
      countries: doc.countries,
      startDate: doc.startDate,
      daysCount: days.length,
      author: { name: author.name },
      days,
      // per currency; conversion to the viewer's currency comes with the FX rates module (ITN-18)
      budget: calculateDaysSubtotal(doc.days),
      updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
    };
  }

  /**
   * ITN-21: copy a public itinerary into the user's own itineraries, as a PRIVATE copy that is
   * independent of the original and credits its author. Private, hidden, unknown or ownerless
   * itineraries are a plain 404, same as viewing them.
   */
  async clone(userId: string, itineraryId: string) {
    if (!Types.ObjectId.isValid(itineraryId)) throw new NotFoundException('Itinerary not found');
    const source = await this.itineraryModel
      .findOne({ _id: new Types.ObjectId(itineraryId), ...PUBLIC_FILTER })
      .lean()
      .exec();
    if (!source) throw new NotFoundException('Itinerary not found');

    const author = await this.userModel
      .findOne({ _id: source.userId, status: AccountStatus.ACTIVE })
      .select('name')
      .lean()
      .exec();
    if (!author) throw new NotFoundException('Itinerary not found');

    const created = await this.itineraryModel.create(
      buildItineraryClone(source, new Types.ObjectId(userId)),
    );
    return {
      id: created._id.toString(),
      title: created.title,
      visibility: created.visibility,
      daysCount: created.days.length,
      originalItineraryId: source._id.toString(),
      originalAuthor: { name: author.name },
      createdAt: (created as unknown as { createdAt: Date }).createdAt,
    };
  }
}

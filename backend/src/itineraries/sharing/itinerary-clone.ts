import { Types } from 'mongoose';
import type { BudgetEntry } from '../schemas/itinerary.schema';

/** Only the fields we read, so this works on Mongoose lean documents and on plain objects. */
export interface CloneSource {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  countries?: string[];
  startDate: Date;
  days?: Array<{
    dayNumber: number;
    city: string;
    notes?: string;
    activities?: Array<{
      name: string;
      description?: string;
      time?: string;
      cost?: number;
      currency?: string;
      images?: string[];
    }>;
    budgetEntries?: Array<{ category: BudgetEntry['category']; amount: number; currency: string }>;
    transportCosts?: Array<{
      mode: string;
      fromCity: string;
      toCity: string;
      amount: number;
      currency: string;
    }>;
  }>;
}

/**
 * ITN-21: the data of a private copy of a public itinerary, owned by `newOwnerId`.
 *
 *  - Every day, activity, budget entry and transport cost is copied with a NEW id, so the copy
 *    is completely independent: editing or deleting one never touches the other.
 *  - It is always Private and never hidden: sharing it is the new owner's own decision.
 *  - Budget entries are copied as plain amounts. A link to the original author's booking
 *    (bookingId / bookingType) is NOT copied: that booking is not the new owner's.
 *  - The original author and itinerary are recorded, so the copy credits its source.
 */
export function buildItineraryClone(source: CloneSource, newOwnerId: Types.ObjectId) {
  const days = [...(source.days ?? [])]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => ({
      _id: new Types.ObjectId(),
      dayNumber: day.dayNumber,
      city: day.city,
      ...(day.notes !== undefined ? { notes: day.notes } : {}),
      activities: (day.activities ?? []).map((a) => ({
        _id: new Types.ObjectId(),
        name: a.name,
        ...(a.description !== undefined ? { description: a.description } : {}),
        ...(a.time !== undefined ? { time: a.time } : {}),
        ...(a.cost !== undefined ? { cost: a.cost } : {}),
        ...(a.currency !== undefined ? { currency: a.currency } : {}),
        images: [...(a.images ?? [])],
      })),
      budgetEntries: (day.budgetEntries ?? []).map((e) => ({
        _id: new Types.ObjectId(),
        category: e.category,
        amount: e.amount,
        currency: e.currency,
      })),
      transportCosts: (day.transportCosts ?? []).map((t) => ({
        _id: new Types.ObjectId(),
        mode: t.mode,
        fromCity: t.fromCity,
        toCity: t.toCity,
        amount: t.amount,
        currency: t.currency,
      })),
    }));

  return {
    userId: newOwnerId,
    title: source.title,
    countries: [...(source.countries ?? [])],
    startDate: source.startDate,
    visibility: 'private' as const,
    isHidden: false,
    days,
    originalAuthorId: source.userId,
    originalItineraryId: source._id,
  };
}

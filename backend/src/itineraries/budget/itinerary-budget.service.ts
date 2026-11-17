import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Itinerary, ItineraryDocument } from '../schemas/itinerary.schema';
import {
  BudgetableDay,
  Subtotal,
  calculateDaySubtotal,
  calculateDaysSubtotal,
} from './budget-calculator';
import { CreateBudgetEntryDto, UpdateBudgetEntryDto } from './dto/budget-entry.dto';
import {
  CreateTransportCostDto,
  UpdateTransportCostDto,
} from './dto/transport-cost.dto';

/** The two arrays of a day that this module owns (Member 6's schema, read-only for us). */
type Field = 'budgetEntries' | 'transportCosts';

/** Keeps one itinerary document small. */
export const MAX_ITEMS_PER_DAY = 50;

/**
 * ITN-14 / ITN-16: budget entries and intercity transport costs of an itinerary day.
 *
 * Every change is ONE atomic update on the itinerary document (positional operators), never
 * "load, edit, save". That way it cannot overwrite a change made at the same time by Member 6's
 * day and activity endpoints. Only the owner can touch an itinerary: anyone else gets 404.
 */
@Injectable()
export class ItineraryBudgetService {
  constructor(
    @InjectModel(Itinerary.name)
    private readonly itineraryModel: Model<ItineraryDocument>,
  ) {}

  // ---------------- subtotals (ITN-09, ITN-14) ----------------
  // Plain calculations, no database access: the caller already has the itinerary loaded.
  // Exported so Member 6's ItinerariesService can show the group subtotal of consecutive days.

  /** Subtotal of one day: budget entries + activity costs + transport costs, per currency. */
  calculateDaySubtotal(day: BudgetableDay): Subtotal {
    return calculateDaySubtotal(day);
  }

  /** Subtotal of several days together (a group of consecutive days in one city, or all days). */
  calculateDaysSubtotal(days: ReadonlyArray<BudgetableDay>): Subtotal {
    return calculateDaysSubtotal(days);
  }

  // ---------------- budget entries (ITN-14) ----------------
  addBudgetEntry(userId: string, itineraryId: string, dayId: string, dto: CreateBudgetEntryDto) {
    return this.add('budgetEntries', userId, itineraryId, dayId, {
      category: dto.category,
      amount: dto.amount,
      currency: dto.currency,
    });
  }

  updateBudgetEntry(
    userId: string,
    itineraryId: string,
    dayId: string,
    entryId: string,
    dto: UpdateBudgetEntryDto,
  ) {
    return this.update('budgetEntries', userId, itineraryId, dayId, entryId, {
      category: dto.category,
      amount: dto.amount,
      currency: dto.currency,
    });
  }

  deleteBudgetEntry(userId: string, itineraryId: string, dayId: string, entryId: string) {
    return this.remove('budgetEntries', userId, itineraryId, dayId, entryId);
  }

  // ---------------- transport costs (ITN-16) ----------------
  addTransportCost(userId: string, itineraryId: string, dayId: string, dto: CreateTransportCostDto) {
    return this.add('transportCosts', userId, itineraryId, dayId, {
      mode: dto.mode,
      fromCity: dto.fromCity,
      toCity: dto.toCity,
      amount: dto.amount,
      currency: dto.currency,
    });
  }

  updateTransportCost(
    userId: string,
    itineraryId: string,
    dayId: string,
    costId: string,
    dto: UpdateTransportCostDto,
  ) {
    return this.update('transportCosts', userId, itineraryId, dayId, costId, {
      mode: dto.mode,
      fromCity: dto.fromCity,
      toCity: dto.toCity,
      amount: dto.amount,
      currency: dto.currency,
    });
  }

  deleteTransportCost(userId: string, itineraryId: string, dayId: string, costId: string) {
    return this.remove('transportCosts', userId, itineraryId, dayId, costId);
  }

  // ---------------- shared logic ----------------
  private async add(
    field: Field,
    userId: string,
    itineraryId: string,
    dayId: string,
    values: Record<string, unknown>,
  ) {
    const { itId, dId } = this.ids(itineraryId, dayId);
    const item = { _id: new Types.ObjectId(), ...values };

    // the day must exist and still have room, checked in the same atomic update
    const updated = await this.itineraryModel
      .findOneAndUpdate(
        {
          _id: itId,
          userId: new Types.ObjectId(userId),
          days: { $elemMatch: { _id: dId, [`${field}.${MAX_ITEMS_PER_DAY - 1}`]: { $exists: false } } },
        },
        { $push: { ['days.$.' + field]: item } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      // either not found / not yours, or the day is full: tell them apart
      await this.assertDayExists(userId, itId, dId);
      throw new ConflictException(
        `A day can have at most ${MAX_ITEMS_PER_DAY} ${field === 'budgetEntries' ? 'budget entries' : 'transport costs'}`,
      );
    }
    return this.view(item);
  }

  private async update(
    field: Field,
    userId: string,
    itineraryId: string,
    dayId: string,
    itemId: string,
    values: Record<string, unknown>,
  ) {
    const { itId, dId, iId } = this.ids(itineraryId, dayId, itemId);
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) set[`days.$[d].${field}.$[e].${key}`] = value;
    }
    if (Object.keys(set).length === 0) {
      throw new BadRequestException('Send at least one field to change');
    }

    const updated = await this.itineraryModel
      .findOneAndUpdate(
        {
          _id: itId,
          userId: new Types.ObjectId(userId),
          days: { $elemMatch: { _id: dId, [field]: this.itemMatch(field, iId) } },
        },
        { $set: set },
        { arrayFilters: [{ 'd._id': dId }, { 'e._id': iId }], returnDocument: 'after' },
      )
      .exec();
    if (!updated) return this.throwNotFoundOrLinked(field, userId, itId, dId, iId);

    const item = updated.days.find((d) => d._id.equals(dId))?.[field].find((x) => x._id.equals(iId));
    return this.view(item as unknown as Record<string, unknown>);
  }

  private async remove(
    field: Field,
    userId: string,
    itineraryId: string,
    dayId: string,
    itemId: string,
  ) {
    const { itId, dId, iId } = this.ids(itineraryId, dayId, itemId);
    const updated = await this.itineraryModel
      .findOneAndUpdate(
        {
          _id: itId,
          userId: new Types.ObjectId(userId),
          days: { $elemMatch: { _id: dId, [field]: this.itemMatch(field, iId) } },
        },
        { $pull: { [`days.$[d].${field}`]: { _id: iId } } },
        { arrayFilters: [{ 'd._id': dId }], returnDocument: 'after' },
      )
      .exec();
    if (!updated) return this.throwNotFoundOrLinked(field, userId, itId, dId, iId);
    return { deleted: true, id: itemId };
  }

  // ---------------- helpers ----------------
  /** Invalid ids are "not found", never a 500. */
  private ids(itineraryId: string, dayId: string, itemId?: string) {
    const parsed = [itineraryId, dayId, itemId ?? dayId];
    if (!parsed.every((v) => Types.ObjectId.isValid(v))) {
      throw new NotFoundException('Itinerary, day or entry not found');
    }
    return {
      itId: new Types.ObjectId(itineraryId),
      dId: new Types.ObjectId(dayId),
      iId: new Types.ObjectId(itemId ?? dayId),
    };
  }

  private async assertDayExists(userId: string, itId: Types.ObjectId, dId: Types.ObjectId) {
    const exists = await this.itineraryModel.exists({
      _id: itId,
      userId: new Types.ObjectId(userId),
      'days._id': dId,
    });
    if (!exists) throw new NotFoundException('Itinerary or day not found');
  }

  /** Match one entry; a budget entry that comes from a linked booking (ITN-27) is excluded. */
  private itemMatch(field: Field, itemId: Types.ObjectId) {
    return field === 'budgetEntries'
      ? { $elemMatch: { _id: itemId, bookingId: { $exists: false } } }
      : { $elemMatch: { _id: itemId } };
  }

  /** The update matched nothing: say whether the entry is missing or belongs to a booking. */
  private async throwNotFoundOrLinked(
    field: Field,
    userId: string,
    itId: Types.ObjectId,
    dId: Types.ObjectId,
    iId: Types.ObjectId,
  ): Promise<never> {
    if (field === 'budgetEntries') {
      const linked = await this.itineraryModel.exists({
        _id: itId,
        userId: new Types.ObjectId(userId),
        days: { $elemMatch: { _id: dId, budgetEntries: { $elemMatch: { _id: iId, bookingId: { $exists: true } } } } },
      });
      if (linked) {
        throw new ConflictException(
          'This budget entry comes from a linked booking. Unlink the booking from the day instead.',
        );
      }
    }
    throw new NotFoundException(this.notFoundMessage(field));
  }

  private notFoundMessage(field: Field) {
    return field === 'budgetEntries'
      ? 'Itinerary, day or budget entry not found'
      : 'Itinerary, day or transport cost not found';
  }

  private view(item: Record<string, unknown>) {
    const { _id, ...rest } = (item as { toObject?: () => Record<string, unknown> }).toObject
      ? (item as { toObject: () => Record<string, unknown> }).toObject()
      : item;
    return { id: String(_id), ...rest };
  }
}

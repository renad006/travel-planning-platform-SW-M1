import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AccountStatus } from '../common/enums/account-status.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { ProviderType } from '../common/enums/provider-type.enum';
import { Role } from '../common/enums/role.enum';
import {
  buildPaginatedResponse,
  getSkip,
  getSort,
} from '../common/utils/pagination.helper';
import {
  FlightBooking,
  FlightBookingDocument,
} from '../flight-bookings/schemas/flight-booking.schema';
import { Airline, AirlineDocument } from '../flights/schemas/airline.schema';
import {
  HotelBooking,
  HotelBookingDocument,
} from '../hotel-bookings/schemas/hotel-booking.schema';
import { Hotel, HotelDocument } from '../hotels/schemas/hotel.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BookingType,
  PaymentStatus,
  RefundStatus,
} from '../payments/enums/payment.enums';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Refund, RefundDocument } from '../payments/schemas/refund.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';
import { ListAccountsDto } from './dto/list-accounts.dto';
import { ListAdminBookingsDto } from './dto/list-admin-bookings.dto';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type ProviderDoc = { name: string; isActive: boolean };
type Populated =
  | { _id: Types.ObjectId; name?: string; email?: string }
  | Types.ObjectId
  | null;

interface LeanFlightBooking {
  _id: Types.ObjectId;
  reference?: string;
  userId: Populated;
  airlineId: Populated;
  departureTime: Date;
  endsAt: Date;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  createdAt: Date;
}

interface LeanHotelBooking {
  _id: Types.ObjectId;
  reference?: string;
  userId: Populated;
  hotelId: Populated;
  checkIn: Date;
  checkOut: Date;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  createdAt: Date;
}

const toRef = (p: Populated) => {
  if (!p) return null;
  if ('name' in p) {
    return { id: String(p._id), name: p.name, email: p.email };
  }
  return { id: String(p) };
};

@Injectable()
export class AdminManagementService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Airline.name)
    private readonly airlineModel: Model<AirlineDocument>,
    @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
    @InjectModel(FlightBooking.name)
    private readonly flightBookingModel: Model<FlightBookingDocument>,
    @InjectModel(HotelBooking.name)
    private readonly hotelBookingModel: Model<HotelBookingDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ACC-14
  async listAccounts(query: ListAccountsDto) {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('name email role status createdAt')
        .sort(getSort(query))
        .skip(getSkip(query))
        .limit(query.limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return buildPaginatedResponse(items, total, query);
  }

  // ACC-15 (moderators) and ACC-16 (users)
  suspend(actor: UserDocument, id: string) {
    return this.changeAccountStatus(
      actor,
      id,
      AccountStatus.ACTIVE,
      AccountStatus.SUSPENDED,
    );
  }

  reactivate(actor: UserDocument, id: string) {
    return this.changeAccountStatus(
      actor,
      id,
      AccountStatus.SUSPENDED,
      AccountStatus.ACTIVE,
    );
  }

  private async changeAccountStatus(
    actor: UserDocument,
    id: string,
    from: AccountStatus,
    to: AccountStatus,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid account id');
    }
    if (actor.id === id) {
      throw new BadRequestException('You cannot change your own account status');
    }
    const target = await this.userModel.findById(id).exec();
    if (!target) throw new NotFoundException('Account not found');
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Admin accounts cannot be suspended or reactivated',
      );
    }
    if (target.status === AccountStatus.DEACTIVATED) {
      throw new BadRequestException('This account was deactivated by its owner');
    }
    if (target.status !== from) {
      throw new ConflictException(
        to === AccountStatus.SUSPENDED
          ? 'Account is already suspended'
          : 'Account is not suspended',
      );
    }

    // Atomic: only flips if the status is still what was just checked
    const updated = await this.userModel
      .findOneAndUpdate({ _id: id, status: from }, { status: to }, { new: true })
      .select('name email role status createdAt')
      .exec();
    if (!updated) {
      throw new ConflictException('Account status changed, please retry');
    }

    const suspended = to === AccountStatus.SUSPENDED;
    await this.audit.log({
      actor: { id: actor.id, role: actor.role },
      action: suspended ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_REACTIVATED',
      targetType: 'user',
      targetId: id,
      metadata: { targetRole: target.role, previousStatus: from },
    });
    await this.notifications.notify({
      userId: id,
      type: suspended ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_REACTIVATED',
      title: suspended ? 'Account suspended' : 'Account reactivated',
      message: suspended
        ? 'Your account has been suspended by an administrator.'
        : 'Your account has been reactivated. You can log in again.',
      related: { type: 'user', id },
    });
    return updated;
  }

  // ACC-15: deactivate / reactivate a hotel or airline
  async setProviderActive(
    actor: UserDocument,
    type: ProviderType,
    id: string,
    active: boolean,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid provider id');
    }
    const model = (
      type === ProviderType.AIRLINE ? this.airlineModel : this.hotelModel
    ) as unknown as Model<ProviderDoc>;

    const provider = await model.findById(id).select('name isActive').exec();
    if (!provider) throw new NotFoundException(`No ${type} found with this id`);
    if (provider.isActive === active) {
      throw new ConflictException(
        active ? `This ${type} is already active` : `This ${type} is already deactivated`,
      );
    }

    // Atomic. Existing Confirmed bookings are not touched.
    const updated = await model
      .findOneAndUpdate(
        { _id: id, isActive: !active },
        { isActive: active },
        { new: true },
      )
      .select('name isActive')
      .exec();
    if (!updated) {
      throw new ConflictException('Provider status changed, please retry');
    }

    await this.audit.log({
      actor: { id: actor.id, role: actor.role },
      action: active ? 'PROVIDER_REACTIVATED' : 'PROVIDER_DEACTIVATED',
      targetType: type,
      targetId: id,
      metadata: { name: provider.name },
    });

    // Affected parties: the moderators of this provider
    const moderators = await this.userModel
      .find({
        assignedProviderType: type,
        assignedProviderId: new Types.ObjectId(id),
      })
      .select('_id')
      .exec();
    await this.notifications.notifyMany({
      userIds: moderators.map((m) => m.id as string),
      type: active ? 'PROVIDER_REACTIVATED' : 'PROVIDER_DEACTIVATED',
      title: active ? `${provider.name} reactivated` : `${provider.name} deactivated`,
      message: active
        ? `Your ${type} "${provider.name}" is active again: it is visible in search and can be booked.`
        : `Your ${type} "${provider.name}" was deactivated by an administrator. It is hidden from search and cannot be booked. Existing confirmed bookings stay valid.`,
      related: { type, id },
    });

    return { id, type, name: updated.name, isActive: updated.isActive };
  }

  // ACC-17: read-only list of all flight and hotel bookings
  async listBookings(query: ListAdminBookingsDto) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }
    const wantFlights = !query.type || query.type === BookingType.FLIGHT;
    const wantHotels = !query.type || query.type === BookingType.HOTEL;
    // Merge two collections: take the newest page*limit of each, then merge
    const take = query.page * query.limit;

    const [flights, flightTotal, hotels, hotelTotal] = await Promise.all([
      wantFlights
        ? (this.flightBookingModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(take)
            .populate('userId', 'name email')
            .populate('airlineId', 'name')
            .lean()
            .exec() as unknown as Promise<LeanFlightBooking[]>)
        : Promise.resolve([] as LeanFlightBooking[]),
      wantFlights
        ? this.flightBookingModel.countDocuments(filter).exec()
        : Promise.resolve(0),
      wantHotels
        ? (this.hotelBookingModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(take)
            .populate('userId', 'name email')
            .populate('hotelId', 'name')
            .lean()
            .exec() as unknown as Promise<LeanHotelBooking[]>)
        : Promise.resolve([] as LeanHotelBooking[]),
      wantHotels
        ? this.hotelBookingModel.countDocuments(filter).exec()
        : Promise.resolve(0),
    ]);

    const rows = [
      ...flights.map((b) => ({
        id: String(b._id),
        type: BookingType.FLIGHT,
        reference: b.reference ?? null,
        user: toRef(b.userId),
        provider: toRef(b.airlineId),
        startDate: b.departureTime,
        endDate: b.endsAt,
        amount: b.totalPrice,
        currency: b.currency,
        status: b.status,
        createdAt: b.createdAt,
      })),
      ...hotels.map((b) => ({
        id: String(b._id),
        type: BookingType.HOTEL,
        reference: b.reference ?? null,
        user: toRef(b.userId),
        provider: toRef(b.hotelId),
        startDate: b.checkIn,
        endDate: b.checkOut,
        amount: b.totalPrice,
        currency: b.currency,
        status: b.status,
        createdAt: b.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(getSkip(query), getSkip(query) + query.limit);

    return buildPaginatedResponse(rows, flightTotal + hotelTotal, query);
  }

  // BON-01 (Bonus): bookings and revenue per provider over a period
  async getAnalytics(query: AdminAnalyticsQueryDto) {
    const dateFilter: Record<string, unknown> = {};
    if (query.from || query.to) {
      dateFilter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const [revenueRows, refundRows] = await Promise.all([
      this.paymentModel.aggregate([
        { $match: { status: PaymentStatus.SUCCEEDED, ...dateFilter } },
        {
          $group: {
            _id: { providerId: '$providerId', bookingType: '$bookingType' },
            bookingsCount: { $sum: 1 },
            grossRevenue: { $sum: '$amount' },
          },
        },
      ]),
      this.refundModel.aggregate([
        { $match: { status: RefundStatus.REFUNDED, ...dateFilter } },
        {
          $lookup: {
            from: 'payments',
            localField: 'paymentId',
            foreignField: '_id',
            as: 'payment',
          },
        },
        { $unwind: '$payment' },
        {
          $group: {
            _id: {
              providerId: '$payment.providerId',
              bookingType: '$payment.bookingType',
            },
            refundedAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const key = (providerId: Types.ObjectId, bookingType: string) =>
      `${providerId.toString()}_${bookingType}`;

    const merged = new Map<
      string,
      {
        providerId: Types.ObjectId;
        bookingType: BookingType;
        bookingsCount: number;
        grossRevenue: number;
        refundedAmount: number;
      }
    >();

    for (const row of revenueRows) {
      merged.set(key(row._id.providerId, row._id.bookingType), {
        providerId: row._id.providerId,
        bookingType: row._id.bookingType,
        bookingsCount: row.bookingsCount,
        grossRevenue: row.grossRevenue,
        refundedAmount: 0,
      });
    }
    for (const row of refundRows) {
      const k = key(row._id.providerId, row._id.bookingType);
      const existing = merged.get(k);
      if (existing) {
        existing.refundedAmount = row.refundedAmount;
      } else {
        merged.set(k, {
          providerId: row._id.providerId,
          bookingType: row._id.bookingType,
          bookingsCount: 0,
          grossRevenue: 0,
          refundedAmount: row.refundedAmount,
        });
      }
    }

    const results = await Promise.all(
      Array.from(merged.values()).map(async (row) => {
        // Branch explicitly instead of sharing a `model` variable:
        // TS can't call .findById on a union of two Mongoose Model types.
        const provider =
          row.bookingType === BookingType.FLIGHT
            ? await this.airlineModel.findById(row.providerId).select('name').exec()
            : await this.hotelModel.findById(row.providerId).select('name').exec();
        return {
          providerId: String(row.providerId),
          providerType: row.bookingType,
          providerName: provider?.name ?? 'Unknown',
          bookingsCount: row.bookingsCount,
          grossRevenue: row.grossRevenue,
          refundedAmount: row.refundedAmount,
          netRevenue: Math.round((row.grossRevenue - row.refundedAmount) * 100) / 100,
        };
      }),
    );

    results.sort((a, b) => b.netRevenue - a.netRevenue);
    return results;
  }
}
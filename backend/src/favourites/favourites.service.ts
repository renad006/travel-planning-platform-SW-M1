import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { buildPaginatedResponse, getSkip } from '../common/utils/pagination.helper';
import { Hotel, HotelDocument } from '../hotels/schemas/hotel.schema';
import { Itinerary, ItineraryDocument } from '../itineraries/schemas/itinerary.schema';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { ListFavouritesDto } from './dto/list-favourites.dto';
import { Favourite, FavouriteDocument } from './schemas/favourite.schema';

// same rule as the shared itinerary search (ITN-21): public and not hidden by an admin
const PUBLIC_ITINERARY = { visibility: 'public', isHidden: { $ne: true } } as const;

@Injectable()
export class FavouritesService {
    constructor(
        @InjectModel(Favourite.name) private readonly favouriteModel: Model<FavouriteDocument>,
        @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
        @InjectModel(Itinerary.name) private readonly itineraryModel: Model<ItineraryDocument>,
    ) {}

    // BON-02: save a hotel, or a public itinerary, to my favourites
    async add(userId: string, dto: AddFavouriteDto) {
        const exists =
            dto.type === 'hotel'
                ? await this.hotelModel.exists({ _id: dto.targetId, isActive: true })
                : await this.itineraryModel.exists({ _id: dto.targetId, ...PUBLIC_ITINERARY });
        if (!exists) {
            throw new NotFoundException(
                dto.type === 'hotel' ? 'Hotel not found' : 'Public itinerary not found',
            );
        }
        try {
            return await this.favouriteModel.create({ userId, type: dto.type, targetId: dto.targetId });
        } catch (e) {
            if ((e as { code?: number }).code === 11000) {
                throw new ConflictException('Already in your favourites');
            }
            throw e;
        }
    }

    async remove(userId: string, id: string) {
        const removed = isValidObjectId(id)
            ? await this.favouriteModel.findOneAndDelete({ _id: id, userId }).exec()
            : null;
        // someone else's favourite is reported as not found, never as forbidden
        if (!removed) {
            throw new NotFoundException('Favourite not found');
        }
        return { removed: true };
    }

    // BON-02: my favourites, newest first. Hotels that went inactive and itineraries that are
    // no longer public are left out of the list (the saved entry stays and comes back if they do).
    async list(userId: string, query: ListFavouritesDto) {
        const filter = { userId, ...(query.type && { type: query.type }) };
        const saved = await this.favouriteModel.find(filter).sort({ createdAt: -1 }).exec();

        const hotelIds = saved.filter((f) => f.type === 'hotel').map((f) => f.targetId);
        const itineraryIds = saved.filter((f) => f.type === 'itinerary').map((f) => f.targetId);
        const [hotels, itineraries] = await Promise.all([
            this.hotelModel.find({ _id: { $in: hotelIds }, isActive: true }).exec(),
            this.itineraryModel.find({ _id: { $in: itineraryIds }, ...PUBLIC_ITINERARY }).exec(),
        ]);
        const hotelById = new Map(hotels.map((h) => [h.id as string, h]));
        const itineraryById = new Map(itineraries.map((i) => [i.id as string, i]));

        const items = saved.flatMap((f): Record<string, unknown>[] => {
            const base = { favouriteId: f.id as string, type: f.type, savedAt: (f as { createdAt?: Date }).createdAt };
            if (f.type === 'hotel') {
                const h = hotelById.get(f.targetId.toString());
                return h
                    ? [{ ...base, hotel: { id: h.id as string, name: h.name, address: h.address, cityId: h.cityId,
                          countryCode: h.countryCode, starClass: h.starClass ?? null, avgRating: h.avgRating,
                          ratingCount: h.ratingCount, photo: h.photos[0] ?? null } }]
                    : [];
            }
            const i = itineraryById.get(f.targetId.toString());
            return i
                ? [{ ...base, itinerary: { id: i.id as string, title: i.title, countries: i.countries,
                      startDate: i.startDate, daysCount: i.days.length } }]
                : [];
        });
        return buildPaginatedResponse(items.slice(getSkip(query), getSkip(query) + query.limit), items.length, query);
    }
}

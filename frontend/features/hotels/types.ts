export interface Hotel {
  _id: string;
  name: string;
  address: string;
  cityId: string;
  countryCode: string;
  description?: string;
  photos: string[];
  starClass?: number;
  amenities: string[];
  checkInTime?: string;
  checkOutTime?: string;
  cancellationTiers: { daysBefore: number; refundPercent: number }[];
  avgRating: number | null;
  ratingCount: number;
}

export interface HotelSearchItem extends Hotel {
  /** Price per night of the cheapest free room (HTL-12). */
  cheapestPrice: number;
}

/** A room free for the whole stay, from GET /api/hotels/:id/rooms/available (HTL-15). */
export interface AvailableRoom {
  _id: string;
  name: string;
  type: string;
  beds: number;
  maxOccupancy: number;
  pricePerNight: number;
  nights: number;
  totalPrice: number;
}

/** Query parameters of GET /api/hotels/search. */
export const SEARCH_KEYS = [
  "cityId",
  "countryCode",
  "checkIn",
  "checkOut",
  "guests",
  "rooms",
  "minPrice",
  "maxPrice",
  "minRating",
  "sortBy",
  "sortOrder",
  "page",
] as const;

/** Kept as strings because the search lives in the URL. */
export type HotelSearchQuery = Partial<Record<(typeof SEARCH_KEYS)[number], string>>;

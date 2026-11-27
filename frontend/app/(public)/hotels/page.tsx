import type { Metadata } from "next";
import { HotelFilters, HotelSearchForm } from "@/features/hotels/components/HotelSearchForm";
import { HotelSearchResults } from "@/features/hotels/components/HotelSearchResults";
import { SearchHero } from "@/features/hotels/components/SearchHero";
import { getPlaceOptions } from "@/features/hotels/places";
import { emptyBox } from "@/features/hotels/styles";
import { SEARCH_KEYS, type HotelSearchQuery } from "@/features/hotels/types";

export const metadata: Metadata = {
  title: "Search hotels | Travel Platform",
  description: "Find hotels with free rooms by city or country, dates and guests, and filter by price and rating.",
};

// Dynamic SSR: results depend on the URL and on live room availability.
export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  // keep only known, filled-in values: the form also submits its empty fields
  const query: HotelSearchQuery = Object.fromEntries(
    SEARCH_KEYS.flatMap((key) => (typeof raw[key] === "string" && raw[key] ? [[key, raw[key]]] : [])),
  );
  const { cities, countries } = await getPlaceOptions();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div>
        <SearchHero
          title="Find your stay"
          subtitle="Search by city or country and see only hotels with rooms free for your whole stay."
        />
        {/* overlaps the lower edge of the header */}
        <div className="relative -mt-10 px-3 lg:px-8">
          <HotelSearchForm query={query} cities={cities} countries={countries} />
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <HotelFilters query={query} />
        {query.checkIn && query.checkOut ? (
          <HotelSearchResults {...query} />
        ) : (
          <p className={emptyBox}>
            Enter your destination and dates to see available hotels.
          </p>
        )}
      </div>
    </main>
  );
}

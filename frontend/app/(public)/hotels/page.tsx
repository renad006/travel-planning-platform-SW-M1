import type { Metadata } from "next";
import { HotelFilters, HotelSearchForm } from "@/features/hotels/components/HotelSearchForm";
import { HotelSearchResults } from "@/features/hotels/components/HotelSearchResults";
import { getPlaceOptions } from "@/features/hotels/places";
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
    <main className="flex w-full flex-col pb-12">
      <header className="bg-brand-navy pt-12 pb-24 text-primary-foreground">
        {/* same width and padding as the content below, so the left edges line up */}
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-medium tracking-widest text-brand-tan uppercase">Hotels</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Find your stay</h1>
          <p className="mt-2 text-primary-foreground/80">
            Search by city or country and see only hotels with rooms free for your whole stay.
          </p>
        </div>
      </header>
      <div className="mx-auto -mt-14 flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6">
        <HotelSearchForm query={query} cities={cities} countries={countries} />
        <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <HotelFilters query={query} />
          {query.checkIn && query.checkOut ? (
            <HotelSearchResults {...query} />
          ) : (
            <p className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-muted-foreground">
              Enter your destination and dates to see available hotels.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

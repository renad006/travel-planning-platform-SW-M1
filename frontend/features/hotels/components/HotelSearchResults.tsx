import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { serverGet } from "@/lib/api.server";
import type { Paginated } from "@/lib/types";
import type { HotelSearchItem, HotelSearchQuery } from "../types";
import { HotelCard } from "./HotelCard";

// URL parameters for the filled-in fields only
const toParams = (query: HotelSearchQuery) =>
  new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])));

/**
 * Hotel search results (HTL-11, HTL-12), a server component. Member 6 reuses it for ITN-25:
 * <HotelSearchResults cityId="cairo" checkIn="2026-12-01" checkOut="2026-12-04" />
 * Page links go to /hotels with the same search.
 */
export async function HotelSearchResults(query: HotelSearchQuery) {
  const request: HotelSearchQuery = { ...query, guests: query.guests ?? "1" };
  let result: Paginated<HotelSearchItem>;
  try {
    result = await serverGet<Paginated<HotelSearchItem>>(`/api/hotels/search?${toParams(request)}`, {
      auth: false,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error; // backend unreachable: the error page handles it
    return (
      <ul role="alert" className="rounded-xl border border-destructive p-4 text-sm text-destructive">
        {error.messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    );
  }

  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  const stay = toParams({
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    guests: request.guests,
    rooms: request.rooms,
  });
  const pageHref = (page: number) => `/hotels?${toParams({ ...request, page: String(page) })}`;

  return (
    <section aria-label="Search results" className="flex flex-col gap-4">
      {result.items.length === 0 ? (
        // Placeholder until the shared EmptyState (Member 1) is merged.
        <p className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-muted-foreground">
          {result.total === 0
            ? "No hotels match this search. Try other dates, fewer guests or a wider price range."
            : "There is nothing on this page."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "hotel" : "hotels"} found
          </p>
          {result.items.map((hotel) => (
            <HotelCard key={hotel._id} hotel={hotel} href={`/hotels/${hotel._id}?${stay}`} />
          ))}
        </>
      )}
      {/* Placeholder until the shared Pagination (Member 1) is merged. */}
      {(pages > 1 || result.page > 1) && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-4 text-sm">
          {result.page > 1 && (
            <Link href={pageHref(Math.min(result.page - 1, pages))} className={buttonVariants({ variant: "outline" })}>
              Previous
            </Link>
          )}
          <span>
            Page {result.page} of {pages}
          </span>
          {result.page < pages && (
            <Link href={pageHref(result.page + 1)} className={buttonVariants({ variant: "outline" })}>
              Next
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}

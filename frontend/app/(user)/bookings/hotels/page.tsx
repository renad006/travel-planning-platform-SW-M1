import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageTitle } from "@/features/hotels/components/PageTitle";
import { formatDate, formatPrice } from "@/features/hotels/format";
import { getMine, guestsLabel, roomLabel, STATUS_LABEL, type ReservationGroups } from "@/features/hotels/reservations";
import { chip, emptyBox, outlineButton, redButton, surface } from "@/features/hotels/styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My hotel reservations | Travel Platform" };

const TABS = [
  { key: "upcoming", label: "Upcoming", empty: "You have no upcoming reservations." },
  { key: "past", label: "Past", empty: "You have no past stays yet." },
  { key: "cancelled", label: "Cancelled", empty: "You have no cancelled reservations." },
] as const;
const PAGE_SIZE = 10;

// Dynamic SSR (HTL-20): the signed-in user's own reservations.
export default async function MyReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const tab = TABS.find((t) => t.key === raw.tab) ?? TABS[0];
  const groups = await getMine<ReservationGroups>("/api/hotel-bookings", "/bookings/hotels");
  const all = groups[tab.key];
  // shortcut: the API returns every reservation at once, so pages are cut here (GEN-05)
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(raw.page)) || 1), pages);
  const shown = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (key: string, to = 1) => `/bookings/hotels?tab=${key}&page=${to}`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6">
      <PageTitle title="My reservations" subtitle="Your hotel stays, past and upcoming." />

      <nav aria-label="Reservation groups" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key)}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn(buttonVariants({ size: "lg" }), "h-10 px-5", t.key === tab.key ? redButton : outlineButton)}
          >
            {t.label} ({groups[t.key].length})
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        // Placeholder until the shared EmptyState (Member 1) is merged.
        <p className={emptyBox}>{tab.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((booking) => (
            <li key={booking._id} className={`flex flex-col gap-3 p-6 ${surface}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{booking.hotelId?.name ?? "Hotel"}</h2>
                  <p className="text-sm text-brand-navy/70">Reference {booking.reference ?? "not issued"}</p>
                </div>
                <span className={chip}>{STATUS_LABEL[booking.status]}</span>
              </div>
              <p className="text-sm">
                {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
              </p>
              <ul className="text-sm text-brand-navy/70">
                {booking.rooms.map((room, index) => (
                  <li key={index}>
                    {roomLabel(room)}: {guestsLabel(room)}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <p className="text-xl font-semibold text-brand-maroon tabular-nums">
                  {formatPrice(booking.totalPrice)}
                </p>
                <Link
                  href={`/bookings/hotels/${booking._id}`}
                  className={cn(buttonVariants({ size: "lg" }), "h-10 px-5", outlineButton)}
                >
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Placeholder until the shared Pagination (Member 1) is merged. */}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link href={href(tab.key, page - 1)} className={cn(buttonVariants({ variant: "outline" }), outlineButton)}>
              Previous
            </Link>
          )}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={href(tab.key, page + 1)} className={cn(buttonVariants({ variant: "outline" }), outlineButton)}>
              Next
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}

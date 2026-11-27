import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cityName, countryName, formatPrice, photoUrl } from "../format";
import { chip, redButton, surface } from "../styles";
import type { HotelSearchItem } from "../types";

export function HotelCard({ hotel, href }: { hotel: HotelSearchItem; href: string }) {
  return (
    <article className={`group flex flex-col overflow-hidden transition hover:shadow-md sm:flex-row ${surface}`}>
      <div className="relative m-2 flex h-52 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-tan/25 sm:mr-0 sm:h-auto sm:min-h-48 sm:w-64">
        {hotel.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by the backend, no image config yet
          <img
            src={photoUrl(hotel.photos[0])}
            alt={hotel.name}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-sm text-brand-navy/70">No photo yet</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-5 p-6 sm:flex-row">
        <div className="flex flex-1 flex-col items-start gap-2">
          {hotel.starClass && (
            <p className="text-sm tracking-widest text-brand-maroon" aria-label={`${hotel.starClass}-star hotel`}>
              {"★".repeat(hotel.starClass)}
            </p>
          )}
          <h2 className="text-xl font-semibold tracking-tight">
            <Link href={href} className="hover:text-brand-maroon">
              {hotel.name}
            </Link>
          </h2>
          <p className="text-sm text-brand-navy/70">
            {hotel.address}, {cityName(hotel.cityId)}, {countryName(hotel.countryCode)}
          </p>
          {hotel.amenities.length > 0 && (
            <ul className="mt-auto flex flex-wrap gap-1.5 pt-2">
              {hotel.amenities.map((a) => (
                <li key={a} className={chip}>
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-end justify-between gap-3 border-t pt-4 sm:w-40 sm:flex-col sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
          {hotel.avgRating === null ? (
            <p className="text-xs text-brand-navy/70">No reviews yet</p>
          ) : (
            <p className="text-right text-xs text-brand-navy/70">
              <span className="mr-1.5 rounded-md bg-brand-navy px-2 py-1 text-sm font-semibold text-card">
                {hotel.avgRating} / 5
              </span>
              {hotel.ratingCount} {hotel.ratingCount === 1 ? "review" : "reviews"}
            </p>
          )}
          <div className="flex flex-col items-end gap-2 sm:w-full">
            <p className="text-right">
              <span className="block text-xs text-brand-navy/70">From</span>
              <span className="text-2xl font-semibold text-brand-maroon tabular-nums">
                {formatPrice(hotel.cheapestPrice)}
              </span>
              <span className="block text-xs text-brand-navy/70">per night</span>
            </p>
            <Link href={href} className={cn(buttonVariants({ size: "lg" }), "h-10 sm:w-full", redButton)}>
              View rooms
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

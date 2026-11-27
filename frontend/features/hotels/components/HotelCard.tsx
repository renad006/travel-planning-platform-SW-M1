import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cityName, countryName, formatPrice, photoUrl } from "../format";
import { redButton } from "../styles";
import type { HotelSearchItem } from "../types";

export function HotelCard({ hotel, href }: { hotel: HotelSearchItem; href: string }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-lg sm:flex-row">
      <div className="relative flex h-52 shrink-0 items-center justify-center overflow-hidden bg-muted sm:h-auto sm:min-h-52 sm:w-72">
        {hotel.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by the backend, no image config yet
          <img
            src={photoUrl(hotel.photos[0])}
            alt={hotel.name}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-sm text-muted-foreground">No photo yet</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {hotel.starClass && (
              <p className="text-sm tracking-widest text-brand-coffee" aria-label={`${hotel.starClass}-star hotel`}>
                {"★".repeat(hotel.starClass)}
              </p>
            )}
            <h2 className="text-xl font-semibold tracking-tight">
              <Link href={href} className="hover:underline">
                {hotel.name}
              </Link>
            </h2>
            <p className="text-sm text-muted-foreground">
              {hotel.address}, {cityName(hotel.cityId)}, {countryName(hotel.countryCode)}
            </p>
          </div>
          {hotel.avgRating === null ? (
            <span className="shrink-0 rounded-lg bg-brand-tan px-2 py-1 text-xs font-semibold text-brand-navy">No reviews</span>
          ) : (
            <div className="shrink-0 text-right">
              <span className="inline-block rounded-lg bg-brand-coffee px-2.5 py-1 text-sm font-semibold text-primary-foreground">
                {hotel.avgRating} / 5
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                {hotel.ratingCount} {hotel.ratingCount === 1 ? "review" : "reviews"}
              </p>
            </div>
          )}
        </div>
        {hotel.amenities.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {hotel.amenities.map((a) => (
              <li key={a} className="rounded-full bg-brand-steel px-3 py-1 text-xs text-card">
                {a}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t pt-3">
          <p>
            <span className="text-xs text-muted-foreground">From </span>
            <span className="text-2xl font-semibold text-brand-maroon">{formatPrice(hotel.cheapestPrice)}</span>
            <span className="text-sm text-muted-foreground"> / night</span>
          </p>
          <Link href={href} className={cn(buttonVariants({ size: "lg" }), redButton)}>
            View rooms
          </Link>
        </div>
      </div>
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/features/hotels/components/HotelSearchForm";
import { PageTitle } from "@/features/hotels/components/PageTitle";
import { BookingSummary, RoomList, RoomSelection } from "@/features/hotels/components/RoomPicker";
import { cityName, countryName, photoUrl } from "@/features/hotels/format";
import { getHotel } from "@/features/hotels/getHotel";
import type { AvailableRoom } from "@/features/hotels/types";
import { chip, emptyBox, redButton, sectionHeading, surface } from "@/features/hotels/styles";
import { ApiError } from "@/lib/api";
import { serverGet } from "@/lib/api.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const hotel = await getHotel((await params).id);
  return {
    title: `${hotel.name} | Travel Platform`,
    description: hotel.description ?? `${hotel.name}, ${hotel.address}, ${cityName(hotel.cityId)}.`,
  };
}

/** A photo cropped to a square; opens full size in a new tab. */
function Photo({ path, alt }: { path: string; alt: string }) {
  return (
    <a href={photoUrl(path)} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl(path)} alt={alt} className="absolute inset-0 size-full object-cover" />
    </a>
  );
}

// Dynamic SSR (HTL-02, HTL-15): available rooms depend on the dates in the URL.
export default async function HotelPage({ params, searchParams }: Props) {
  const { id } = await params;
  const raw = await searchParams;
  const value = (key: string) => (typeof raw[key] === "string" ? raw[key] : "");
  const checkIn = value("checkIn");
  const checkOut = value("checkOut");
  const guests = value("guests") || "2";
  const roomCount = value("rooms") || "1";
  const today = new Date().toISOString().slice(0, 10);
  const hotel = await getHotel(id);

  let rooms: AvailableRoom[] = [];
  let errors: string[] = [];
  if (checkIn && checkOut) {
    try {
      rooms = await serverGet<AvailableRoom[]>(`/api/hotels/${hotel._id}/rooms/available`, {
        auth: false,
        params: { checkIn, checkOut },
      });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      errors = error.messages;
    }
  }

  const tiers = [...hotel.cancellationTiers].sort((a, b) => b.daysBefore - a.daysBefore);
  const [cover, ...others] = hotel.photos;
  const rating =
    hotel.avgRating === null
      ? "No reviews yet"
      : `${hotel.avgRating.toFixed(1)} / 5 · ${hotel.ratingCount} ${hotel.ratingCount === 1 ? "review" : "reviews"}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
      <Link
        href="/hotels"
        className="inline-flex h-10 items-center self-start rounded-full bg-brand-tan px-4 text-sm font-semibold text-brand-navy transition hover:bg-brand-tan/80 focus-visible:ring-3 focus-visible:ring-ring"
      >
        ← Back to search
      </Link>
      <PageTitle
        title={hotel.name}
        subtitle={`${hotel.address}, ${cityName(hotel.cityId)}, ${countryName(hotel.countryCode)}`}
      >
        <p className="mt-3 flex flex-wrap items-center gap-3">
          {hotel.starClass ? (
            <span className="tracking-widest text-brand-maroon" aria-label={`${hotel.starClass} star hotel`}>
              {"★".repeat(hotel.starClass)}
            </span>
          ) : null}
          <span className={chip}>{rating}</span>
        </p>
      </PageTitle>
      <section aria-label="Photos">
        {cover ? (
          // square cover on one half, up to four square photos on the other
          <div className="grid gap-2 sm:grid-cols-2">
            <Photo path={cover} alt={`${hotel.name}, photo 1`} />
            <div className="grid grid-cols-2 content-start gap-2">
              {others.map((photo, index) => (
                <Photo key={photo} path={photo} alt={`${hotel.name}, photo ${index + 2}`} />
              ))}
              {/* a hotel has at most five photos: plain tiles keep the empty slots square */}
              {Array.from({ length: Math.max(0, 4 - others.length) }, (_, index) => (
                <div key={index} aria-hidden className="aspect-square rounded-xl bg-brand-tan/25" />
              ))}
            </div>
          </div>
        ) : (
          <p className="flex h-48 items-center justify-center rounded-xl bg-brand-tan/25 text-sm">
            No photos yet
          </p>
        )}
      </section>

      {/* key: a new search starts with nothing selected */}
      <RoomSelection key={`${checkIn}-${checkOut}`} rooms={rooms}>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-8">
            {(hotel.description || hotel.amenities.length > 0) && (
              <section className="flex flex-col gap-3">
                <h2 className={sectionHeading}>About this hotel</h2>
                {hotel.description && <p className="max-w-prose leading-relaxed text-brand-navy/70">{hotel.description}</p>}
                <ul aria-label="Amenities" className="flex flex-wrap gap-2">
                  {hotel.amenities.map((amenity) => (
                    <li key={amenity} className={chip}>
                      {amenity}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section id="rooms" className="flex flex-col gap-4">
              <h2 className={sectionHeading}>Available rooms</h2>
              <form
                key={`${checkIn}-${checkOut}`}
                action={`/hotels/${hotel._id}#rooms`}
                className={`grid grid-cols-2 items-end gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] ${surface}`}
              >
                <input type="hidden" name="guests" value={guests} />
                <input type="hidden" name="rooms" value={roomCount} />
                <Input text="Check-in" type="date" name="checkIn" required min={today} defaultValue={checkIn} />
                <Input text="Check-out" type="date" name="checkOut" required min={today} defaultValue={checkOut} />
                <Button type="submit" size="lg" className={`col-span-2 h-11 px-7 sm:col-span-1 ${redButton}`}>
                  {checkIn && checkOut ? "Change dates" : "Show rooms"}
                </Button>
              </form>
              {errors.length > 0 ? (
                <ul role="alert" className="rounded-xl border border-destructive bg-card p-4 text-sm text-destructive">
                  {errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : rooms.length > 0 ? (
                <RoomList />
              ) : (
                // Placeholder until the shared EmptyState (Member 1) is merged.
                <p className={emptyBox}>
                  {checkIn && checkOut
                    ? "No rooms are free for these dates. Try other dates."
                    : "Choose your dates to see free rooms and prices."}
                </p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className={sectionHeading}>Reviews</h2>
              {/* Placeholder: Member 5's reviews section goes here. */}
              <p className={emptyBox}>
                {rating}
              </p>
            </section>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
            <div className={`flex flex-col gap-5 p-5 ${surface}`}>
              <section>
                <h2 className="text-sm font-semibold">Check-in and check-out</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    ["Check-in", hotel.checkInTime],
                    ["Check-out", hotel.checkOutTime],
                  ].map(([label, time]) => (
                    <div key={label} className="rounded-lg bg-brand-tan/25 p-3">
                      <dt className="text-xs text-brand-navy/70">{label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{time ?? "Not set"}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="border-t pt-4">
                <h2 className="text-sm font-semibold">Cancellation policy</h2>
                {tiers.length === 0 ? (
                  <p className="mt-3 text-sm text-brand-navy/70">No refund on cancellation.</p>
                ) : (
                  <ul className="mt-2 divide-y text-sm">
                    {tiers.map((tier) => (
                      <li key={tier.daysBefore} className="flex justify-between gap-3 py-2">
                        <span>
                          {tier.daysBefore}+ {tier.daysBefore === 1 ? "day" : "days"} before check-in
                        </span>
                        <span className="font-semibold whitespace-nowrap text-brand-maroon">
                          {tier.refundPercent}% refund
                        </span>
                      </li>
                    ))}
                    <li className="pt-2 text-xs text-brand-navy/70">Later cancellations are not refunded.</li>
                  </ul>
                )}
              </section>
            </div>
            {rooms.length > 0 && (
              <BookingSummary stay={{ hotelId: hotel._id, checkIn, checkOut, guests, rooms: roomCount }} />
            )}
          </aside>
        </div>
      </RoomSelection>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HeroBanner } from "@/features/hotels/components/HeroBanner";
import { Input } from "@/features/hotels/components/HotelSearchForm";
import { BookingSummary, RoomList, RoomSelection } from "@/features/hotels/components/RoomPicker";
import { cityName, countryName, photoUrl } from "@/features/hotels/format";
import type { AvailableRoom, Hotel } from "@/features/hotels/types";
import { redButton, sectionHeading } from "@/features/hotels/styles";
import { ApiError } from "@/lib/api";
import { serverGet } from "@/lib/api.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function getHotel(id: string) {
  try {
    return await serverGet<Hotel>(`/api/hotels/${encodeURIComponent(id)}`, { auth: false });
  } catch (error) {
    // 400: malformed id, 404: no such hotel
    if (error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 404)) notFound();
    throw error;
  }
}

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

const card = "rounded-2xl border bg-card p-5";

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
    <main className="flex w-full flex-col pb-12">
      <HeroBanner>
        <Link
          href="/hotels"
          className="inline-flex h-10 items-center rounded-lg bg-brand-tan px-4 text-sm font-semibold text-brand-navy shadow-md hover:bg-card focus-visible:ring-3 focus-visible:ring-ring"
        >
          ← Back to search
        </Link>
        {hotel.starClass ? (
          <p className="mt-4 text-brand-tan" aria-label={`${hotel.starClass} star hotel`}>
            {"★".repeat(hotel.starClass)}
          </p>
        ) : null}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{hotel.name}</h1>
        <p className="mt-2 font-bold text-brand-tan">
          {hotel.address}, {cityName(hotel.cityId)}, {countryName(hotel.countryCode)}
        </p>
        <p className="mt-3 inline-block rounded-lg bg-brand-tan px-3 py-1 text-sm font-semibold text-brand-navy">
          {rating}
        </p>
      </HeroBanner>

      <div className="relative mx-auto -mt-14 flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6">
        <section aria-label="Photos" className="rounded-2xl border bg-card p-2 shadow-lg">
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
                  <div key={index} aria-hidden className="aspect-square rounded-xl bg-brand-tan/40" />
                ))}
              </div>
            </div>
          ) : (
            <p className="flex h-48 items-center justify-center rounded-xl bg-muted text-muted-foreground">
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
                  {hotel.description && <p className="text-muted-foreground">{hotel.description}</p>}
                  <ul aria-label="Amenities" className="flex flex-wrap gap-2">
                    {hotel.amenities.map((amenity) => (
                      <li key={amenity} className="rounded-full bg-brand-steel px-3 py-1 text-sm text-card">
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
                  className={`${card} grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]`}
                >
                  <input type="hidden" name="guests" value={guests} />
                  <input type="hidden" name="rooms" value={roomCount} />
                  <Input text="Check-in" type="date" name="checkIn" required min={today} defaultValue={checkIn} />
                  <Input text="Check-out" type="date" name="checkOut" required min={today} defaultValue={checkOut} />
                  <Button type="submit" size="lg" className={`col-span-2 h-10 px-6 sm:col-span-1 ${redButton}`}>
                    {checkIn && checkOut ? "Change dates" : "Show rooms"}
                  </Button>
                </form>
                {errors.length > 0 ? (
                  <ul role="alert" className="rounded-xl border border-destructive p-4 text-sm text-destructive">
                    {errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : rooms.length > 0 ? (
                  <RoomList />
                ) : (
                  // Placeholder until the shared EmptyState (Member 1) is merged.
                  <p className="rounded-2xl border border-dashed bg-card/60 p-8 text-center text-muted-foreground">
                    {checkIn && checkOut
                      ? "No rooms are free for these dates. Try other dates."
                      : "Choose your dates to see free rooms and prices."}
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className={sectionHeading}>Reviews</h2>
                {/* Placeholder: Member 5's reviews section goes here. */}
                <p className="rounded-2xl border border-dashed bg-card/60 p-8 text-center text-muted-foreground">
                  {rating}
                </p>
              </section>
            </div>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
              <section className={card}>
                <h2 className="font-semibold text-brand-coffee">Check-in and check-out</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Check-in</dt>
                    <dd className="text-lg font-semibold text-brand-steel">{hotel.checkInTime ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Check-out</dt>
                    <dd className="text-lg font-semibold text-brand-steel">{hotel.checkOutTime ?? "Not set"}</dd>
                  </div>
                </dl>
              </section>
              <section className={card}>
                <h2 className="font-semibold text-brand-maroon">Cancellation policy</h2>
                {tiers.length === 0 ? (
                  <p className="mt-3 text-sm">No refund on cancellation.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {tiers.map((tier) => (
                      <li key={tier.daysBefore} className="flex justify-between gap-3">
                        <span>
                          {tier.daysBefore}+ {tier.daysBefore === 1 ? "day" : "days"} before check-in
                        </span>
                        <span className="font-semibold whitespace-nowrap text-brand-maroon">{tier.refundPercent}% refund</span>
                      </li>
                    ))}
                    <li className="text-muted-foreground">Later cancellations are not refunded.</li>
                  </ul>
                )}
              </section>
              {rooms.length > 0 && (
                <BookingSummary stay={{ hotelId: hotel._id, checkIn, checkOut, guests, rooms: roomCount }} />
              )}
            </aside>
          </div>
        </RoomSelection>
      </div>
    </main>
  );
}

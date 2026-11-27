import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { BookingForm } from "@/features/hotels/components/BookingForm";
import { PageTitle } from "@/features/hotels/components/PageTitle";
import { getHotel } from "@/features/hotels/getHotel";
import { redButton, surface } from "@/features/hotels/styles";
import type { AvailableRoom } from "@/features/hotels/types";
import { ApiError } from "@/lib/api";
import { serverGet } from "@/lib/api.server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Book your stay | Travel Platform" };

// Dynamic SSR: the chosen rooms come from the URL and must still be free.
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const value = (key: string) => (typeof raw[key] === "string" ? raw[key] : "");
  const hotelId = value("hotelId");
  const checkIn = value("checkIn");
  const checkOut = value("checkOut");
  const roomIds = [raw.roomId ?? []].flat();
  if (!hotelId || !checkIn || !checkOut || roomIds.length === 0) notFound();

  const hotel = await getHotel(hotelId);
  let rooms: AvailableRoom[] = [];
  let errors: string[] = [];
  try {
    const free = await serverGet<AvailableRoom[]>(`/api/hotels/${hotel._id}/rooms/available`, {
      auth: false,
      params: { checkIn, checkOut },
    });
    rooms = free.filter((room) => roomIds.includes(room._id));
    if (rooms.length !== new Set(roomIds).size) errors = ["A room you chose is no longer available for these dates."];
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    errors = error.messages;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
      <PageTitle title={hotel.name} subtitle="Check your stay and tell us who is coming." />
      {errors.length > 0 ? (
        <div role="alert" className={`flex flex-col items-start gap-3 p-6 ${surface}`}>
          {errors.map((message) => (
            <p key={message} className="text-destructive">
              {message}
            </p>
          ))}
          <Link
            href={`/hotels/${hotel._id}?${new URLSearchParams({ checkIn, checkOut })}#rooms`}
            className={cn(buttonVariants({ size: "lg" }), redButton)}
          >
            See free rooms
          </Link>
        </div>
      ) : (
        <BookingForm
          hotel={hotel}
          rooms={rooms}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={Number(value("guests")) || 1}
        />
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatPrice } from "../format";
import { initialGuests, roomError, type RoomGuests } from "../guests";
import { redButton, sectionHeading, surface } from "../styles";
import type { AvailableRoom, Hotel } from "../types";
import { Select } from "./HotelSearchForm";

const numbers = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ value: String(from + i), label: String(from + i) }));

/** Guests per room and the total (HTL-16), then the 10-minute hold and checkout (HTL-18). */
export function BookingForm({
  hotel,
  rooms,
  checkIn,
  checkOut,
  guests,
}: {
  hotel: Hotel;
  rooms: AvailableRoom[];
  checkIn: string;
  checkOut: string;
  guests: number;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<RoomGuests[]>(() =>
    initialGuests(
      guests,
      rooms.map((room) => room.maxOccupancy),
    ),
  );
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<{ messages: string[]; taken: boolean } | null>(null);

  const total = rooms.reduce((sum, room) => sum + room.totalPrice, 0);
  const noAdult = entries.every((entry) => entry.adults === 0);
  const backToRooms = `/hotels/${hotel._id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}#rooms`;

  const update = (index: number, change: Partial<RoomGuests>) =>
    setEntries(entries.map((entry, i) => (i === index ? { ...entry, ...change } : entry)));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setFailure(null);
    if (noAdult || entries.some((entry, i) => roomError(entry, rooms[i].maxOccupancy))) return;

    setSending(true);
    try {
      const booking = await api.post<{ _id: string }>("/api/hotel-bookings", {
        hotelId: hotel._id,
        checkIn,
        checkOut,
        rooms: entries.map((entry, i) => ({
          roomId: rooms[i]._id,
          adults: entry.adults,
          childrenAges: entry.childrenAges.map(Number),
        })),
      });
      router.push(`/checkout/hotel/${booking._id}`);
    } catch (error) {
      setSending(false);
      setFailure(
        error instanceof ApiError
          ? // 409: someone else took a room; 404: a room was removed
            { messages: error.messages, taken: error.statusCode === 409 || error.statusCode === 404 }
          : { messages: ["We could not reach the server. Try again."], taken: false },
      );
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className={sectionHeading}>Who is staying?</h2>
          <p className="mt-1 text-sm text-brand-navy/70">At least one adult is needed on the reservation.</p>
        </div>

        {rooms.map((room, index) => {
          const entry = entries[index];
          const error = submitted ? roomError(entry, room.maxOccupancy) : null;
          return (
            <fieldset key={room._id} className={`p-5 ${surface}`}>
              <legend className="sr-only">
                {room.type}, room {room.name}
              </legend>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {room.type} · Room {room.name}
                  </p>
                  <p className="text-sm text-brand-navy/70">
                    {room.beds} {room.beds === 1 ? "bed" : "beds"} · up to {room.maxOccupancy}{" "}
                    {room.maxOccupancy === 1 ? "guest" : "guests"}
                  </p>
                </div>
                <p className="text-lg font-semibold text-brand-maroon">{formatPrice(room.totalPrice)}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Select
                  text="Adults"
                  value={entry.adults}
                  onChange={(e) => update(index, { adults: Number(e.target.value) })}
                  options={numbers(0, room.maxOccupancy)}
                />
                <Select
                  text="Children"
                  value={entry.childrenAges.length}
                  onChange={(e) =>
                    update(index, {
                      childrenAges: Array.from(
                        { length: Number(e.target.value) },
                        (_, i) => entry.childrenAges[i] ?? "",
                      ),
                    })
                  }
                  options={numbers(0, room.maxOccupancy)}
                />
                {entry.childrenAges.map((age, child) => (
                  <Select
                    key={child}
                    text={`Child ${child + 1} age`}
                    value={age}
                    onChange={(e) =>
                      update(index, {
                        childrenAges: entry.childrenAges.map((a, i) => (i === child ? e.target.value : a)),
                      })
                    }
                    options={[{ value: "", label: "Choose" }, ...numbers(0, 17)]}
                  />
                ))}
              </div>
              {error && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </fieldset>
          );
        })}
      </section>

      <aside className={`flex flex-col gap-3 p-5 lg:sticky lg:top-4 ${surface}`}>
        <h2 className="border-b pb-3 text-sm font-semibold">Your stay</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-brand-navy/70">Check-in{hotel.checkInTime && ` from ${hotel.checkInTime}`}</dt>
            <dd className="font-semibold">{formatDate(checkIn)}</dd>
          </div>
          <div>
            <dt className="text-brand-navy/70">Check-out{hotel.checkOutTime && ` by ${hotel.checkOutTime}`}</dt>
            <dd className="font-semibold">{formatDate(checkOut)}</dd>
          </div>
        </dl>
        <p className="flex items-baseline justify-between gap-3 rounded-lg bg-brand-tan/25 p-3">
          <span className="text-sm">
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"} · {rooms[0].nights}{" "}
            {rooms[0].nights === 1 ? "night" : "nights"}
          </span>
          <span className="text-2xl font-semibold text-brand-maroon">{formatPrice(total)}</span>
        </p>

        {submitted && noAdult && (
          <p role="alert" className="rounded-xl bg-card p-3 text-sm text-destructive">
            Add at least one adult to the reservation.
          </p>
        )}
        {failure && (
          <div role="alert" className="rounded-xl border border-destructive bg-card p-3 text-sm text-destructive">
            {failure.taken && <p className="font-semibold">A room is no longer available.</p>}
            {failure.messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        <Button type="submit" size="lg" className={`h-11 w-full ${redButton}`} disabled={sending}>
          {sending ? "Holding your rooms…" : "Proceed to payment"}
        </Button>
        <p className="text-center text-xs text-brand-navy/70">Your rooms are held for 10 minutes while you pay.</p>
        <Link href={backToRooms} className="text-center text-sm font-semibold text-brand-maroon hover:underline">
          Change rooms
        </Link>
      </aside>
    </form>
  );
}

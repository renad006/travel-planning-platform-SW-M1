"use client";

import { createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "../format";
import { redButton } from "../styles";
import type { AvailableRoom } from "../types";

const Selection = createContext<{
  rooms: AvailableRoom[];
  selected: string[];
  setSelected: (ids: string[]) => void;
}>({ rooms: [], selected: [], setSelected: () => {} });

/** Shares the chosen rooms between the room list and the booking summary, which sit in different columns. */
export function RoomSelection({ rooms, children }: { rooms: AvailableRoom[]; children: React.ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);
  return <Selection value={{ rooms, selected, setSelected }}>{children}</Selection>;
}

/** Select one or more free rooms (HTL-15). */
export function RoomList() {
  const { rooms, selected, setSelected } = useContext(Selection);
  return (
    <div className="flex flex-col gap-3">
      {rooms.map((room) => (
        <label
          key={room._id}
          className="flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 transition hover:shadow-md has-checked:border-brand-maroon has-checked:bg-brand-tan/20"
        >
          <input
            type="checkbox"
            checked={selected.includes(room._id)}
            onChange={(event) =>
              setSelected(event.target.checked ? [...selected, room._id] : selected.filter((id) => id !== room._id))
            }
            className="size-5 shrink-0 accent-brand-maroon"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold text-brand-coffee">
              {room.type} · Room {room.name}
            </span>
            <span className="text-sm text-muted-foreground">
              {room.beds} {room.beds === 1 ? "bed" : "beds"} · up to {room.maxOccupancy}{" "}
              {room.maxOccupancy === 1 ? "guest" : "guests"}
            </span>
          </span>
          <span className="flex flex-col items-end">
            <span className="text-lg font-semibold text-brand-maroon">{formatPrice(room.totalPrice)}</span>
            <span className="text-right text-xs text-muted-foreground">
              {formatPrice(room.pricePerNight)} × {room.nights} {room.nights === 1 ? "night" : "nights"}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** Submits hotelId, the stay and one roomId per chosen room to /hotels/book. */
export function BookingSummary({ stay }: { stay: Record<string, string> }) {
  const { rooms, selected } = useContext(Selection);
  const chosen = rooms.filter((room) => selected.includes(room._id));
  const total = chosen.reduce((sum, room) => sum + room.totalPrice, 0);

  return (
    <form action="/hotels/book" className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-lg">
      {Object.entries(stay).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {chosen.map((room) => (
        <input key={room._id} type="hidden" name="roomId" value={room._id} />
      ))}
      <p aria-live="polite" className="text-sm">
        {chosen.length === 0
          ? "Select at least one room."
          : `${chosen.length} ${chosen.length === 1 ? "room" : "rooms"} · ${formatPrice(total)} total`}
      </p>
      <Button type="submit" size="lg" className={`h-10 w-full ${redButton}`} disabled={chosen.length === 0}>
        Continue to booking
      </Button>
    </form>
  );
}

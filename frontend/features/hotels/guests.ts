/** Guests of one room while the booking form is being filled in. */
export interface RoomGuests {
  adults: number;
  /** One entry per child; "" until an age is chosen. */
  childrenAges: string[];
}

/** Spreads the searched number of guests over the chosen rooms as adults, within each room's limit. */
export function initialGuests(guests: number, maxOccupancy: number[]): RoomGuests[] {
  let left = guests;
  return maxOccupancy.map((max, index) => {
    const share = Math.ceil(left / (maxOccupancy.length - index));
    const adults = Math.max(0, Math.min(max, share));
    left -= adults;
    return { adults, childrenAges: [] };
  });
}

/** The same rules the backend checks (HTL-16), so the message appears next to the field. */
export function roomError({ adults, childrenAges }: RoomGuests, maxOccupancy: number): string | null {
  const total = adults + childrenAges.length;
  if (total === 0) return "Add at least one guest to this room.";
  if (total > maxOccupancy) return `This room takes at most ${maxOccupancy} guests.`;
  if (childrenAges.includes("")) return "Choose an age for every child.";
  return null;
}

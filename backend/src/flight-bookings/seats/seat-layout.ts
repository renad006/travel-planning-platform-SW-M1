/**
 * FLT-28: seat layout of a cabin. Pure functions, no database, no framework.
 *
 * The airline only stores HOW MANY seats a cabin has (CabinInventory.totalSeats), so the layout
 * is derived from that number and the cabin class: the same input always gives the same seats.
 * Seats are labelled like a real plane: a row number and a letter, for example "30C".
 */
export type CabinName = 'First' | 'Business' | 'Premium Economy' | 'Economy';

interface CabinShape {
  /** Seat letters of one row, left to right. */
  columns: string[];
  /** Columns after which there is an aisle (for drawing the map). */
  aisleAfter: string[];
  /**
   * Number of the first row. The starting rows (1, 20, 40, 60) leave room for 19 rows of First,
   * 20 of Business and 20 of Premium Economy (76 / 80 / 120 seats), so those cabins never share
   * a seat label. Economy is the last cabin and can be as long as it needs.
   */
  firstRow: number;
}

const SHAPES: Record<CabinName, CabinShape> = {
  First: { columns: ['A', 'C', 'D', 'F'], aisleAfter: ['C'], firstRow: 1 },
  Business: { columns: ['A', 'C', 'D', 'F'], aisleAfter: ['C'], firstRow: 20 },
  'Premium Economy': { columns: ['A', 'B', 'C', 'D', 'E', 'F'], aisleAfter: ['C'], firstRow: 40 },
  Economy: { columns: ['A', 'B', 'C', 'D', 'E', 'F'], aisleAfter: ['C'], firstRow: 60 },
};

export interface SeatRow {
  row: number;
  seats: string[];
}

export interface SeatLayout {
  columns: string[];
  aisleAfter: string[];
  rows: SeatRow[];
  totalSeats: number;
}

const shapeOf = (cabin: string): CabinShape | null =>
  Object.prototype.hasOwnProperty.call(SHAPES, cabin) ? SHAPES[cabin as CabinName] : null;

/** The layout of a cabin with `totalSeats` seats; the last row may be partly filled. */
export function buildSeatLayout(cabin: string, totalSeats: number): SeatLayout {
  const shape = shapeOf(cabin);
  if (!shape || !Number.isInteger(totalSeats) || totalSeats < 1) {
    return { columns: [], aisleAfter: [], rows: [], totalSeats: 0 };
  }
  const rows: SeatRow[] = [];
  for (let i = 0; i < totalSeats; i += shape.columns.length) {
    const row = shape.firstRow + rows.length;
    const letters = shape.columns.slice(0, Math.min(shape.columns.length, totalSeats - i));
    rows.push({ row, seats: letters.map((c) => `${row}${c}`) });
  }
  return { columns: shape.columns, aisleAfter: shape.aisleAfter, rows, totalSeats };
}

/** Upper-cases and trims a seat label ("30c " -> "30C"). */
export const normalizeSeat = (seat: string): string => String(seat ?? '').trim().toUpperCase();

/** true when the seat exists in a cabin with `totalSeats` seats. */
export function seatExists(cabin: string, totalSeats: number, seat: string): boolean {
  const wanted = normalizeSeat(seat);
  return buildSeatLayout(cabin, totalSeats).rows.some((r) => r.seats.includes(wanted));
}

/** FLT-28 rules. */
export const MAX_SEAT_PICKS = 3; // a passenger can pick a seat at most 3 times in total
export const SEAT_LOCK_HOURS = 24; // no choosing or changing within 24 hours of departure

/** The moment seat changes close for a flight. */
export const seatLockTime = (departure: Date): Date =>
  new Date(new Date(departure).getTime() - SEAT_LOCK_HOURS * 3_600_000);

export const isSeatLocked = (departure: Date, now: Date = new Date()): boolean =>
  now.getTime() >= seatLockTime(departure).getTime();

/**
 * Automatic seats for `count` passengers of ONE booking: keeps them together in the first row with
 * enough free seats side by side; otherwise takes the first free seats in order. Returns fewer
 * seats than asked only when the cabin is full.
 */
export function pickSeatsForGroup(layout: SeatLayout, taken: ReadonlySet<string>, count: number): string[] {
  if (count <= 0) return [];
  for (const row of layout.rows) {
    for (let start = 0; start + count <= row.seats.length; start++) {
      const run = row.seats.slice(start, start + count);
      if (run.every((seat) => !taken.has(seat))) return run;
    }
  }
  const free = layout.rows.flatMap((r) => r.seats).filter((seat) => !taken.has(seat));
  return free.slice(0, count);
}

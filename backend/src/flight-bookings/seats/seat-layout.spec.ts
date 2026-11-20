import {
  buildSeatLayout,
  isSeatLocked,
  normalizeSeat,
  pickSeatsForGroup,
  seatExists,
  seatLockTime,
} from './seat-layout';

describe('seat layout (FLT-28)', () => {
  it('builds rows of 6 for economy and labels seats like a plane', () => {
    const l = buildSeatLayout('Economy', 12);
    expect(l.rows).toHaveLength(2);
    expect(l.rows[0].seats).toEqual(['60A', '60B', '60C', '60D', '60E', '60F']);
    expect(l.rows[1].row).toBe(61);
  });

  it('fills the last row only as far as the seats go', () => {
    const l = buildSeatLayout('Economy', 8);
    expect(l.rows[1].seats).toEqual(['61A', '61B']);
    expect(l.rows.flatMap((r) => r.seats)).toHaveLength(8);
  });

  it('business and first have 4 seats per row', () => {
    expect(buildSeatLayout('Business', 5).rows.map((r) => r.seats.length)).toEqual([4, 1]);
    expect(buildSeatLayout('First', 4).rows[0].seats).toEqual(['1A', '1C', '1D', '1F']);
  });

  it('cabins never share a seat label', () => {
    const sizes: Array<[string, number]> = [['First', 40], ['Business', 80], ['Premium Economy', 100], ['Economy', 300]];
    const all = sizes.flatMap(([c, n]) => buildSeatLayout(c, n).rows.flatMap((r) => r.seats));
    expect(new Set(all).size).toBe(all.length);
  });

  it('is the same every time', () => {
    expect(buildSeatLayout('Economy', 50)).toEqual(buildSeatLayout('Economy', 50));
  });

  it('checks that a seat exists', () => {
    expect(seatExists('Economy', 8, '61B')).toBe(true);
    expect(seatExists('Economy', 8, '61C')).toBe(false); // beyond 8 seats
    expect(seatExists('Economy', 8, '1A')).toBe(false); // a first-class label
    expect(seatExists('Economy', 8, ' 60a ')).toBe(true);
    expect(seatExists('Economy', 8, 'nonsense')).toBe(false);
  });

  it('gives an empty layout for an unknown cabin or bad size', () => {
    expect(buildSeatLayout('Steerage', 10).rows).toEqual([]);
    expect(buildSeatLayout('Economy', 0).rows).toEqual([]);
    expect(normalizeSeat(' 30c')).toBe('30C');
  });
});

describe('seat rules and automatic seats (FLT-28)', () => {
  const layout = buildSeatLayout('Economy', 12); // rows 60 and 61, A-F

  it('seat changes close exactly 24 hours before departure', () => {
    const dep = new Date('2026-12-10T12:00:00Z');
    expect(seatLockTime(dep).toISOString()).toBe('2026-12-09T12:00:00.000Z');
    expect(isSeatLocked(dep, new Date('2026-12-09T11:59:59Z'))).toBe(false);
    expect(isSeatLocked(dep, new Date('2026-12-09T12:00:00Z'))).toBe(true);
    expect(isSeatLocked(dep, new Date('2026-12-10T08:00:00Z'))).toBe(true);
  });

  it('keeps a group together in the first row that fits', () => {
    expect(pickSeatsForGroup(layout, new Set(), 3)).toEqual(['60A', '60B', '60C']);
    // 60A-60D taken: only 60E,60F are left in row 60, so a group of 3 moves to row 61
    expect(pickSeatsForGroup(layout, new Set(['60A', '60B', '60C', '60D']), 3)).toEqual(['61A', '61B', '61C']);
  });

  it('uses a gap in a row when the group fits there', () => {
    expect(pickSeatsForGroup(layout, new Set(['60A', '60B']), 2)).toEqual(['60C', '60D']);
  });

  it('falls back to the first free seats when no row has room', () => {
    const taken = new Set(['60B', '60D', '60F', '61B', '61D', '61F']);
    expect(pickSeatsForGroup(layout, taken, 2)).toEqual(['60A', '60C']);
  });

  it('gives fewer seats only when the cabin is full', () => {
    const taken = new Set(layout.rows.flatMap((r) => r.seats).filter((s) => s !== '61F'));
    expect(pickSeatsForGroup(layout, taken, 3)).toEqual(['61F']);
    expect(pickSeatsForGroup(layout, new Set(), 0)).toEqual([]);
  });
});

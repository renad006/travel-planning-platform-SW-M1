import {
  UNSPECIFIED_CURRENCY,
  calculateDaySubtotal,
  calculateDaysSubtotal,
  normalizeCurrency,
} from './budget-calculator';

describe('budget calculator (ITN-09 / ITN-14)', () => {
  it('an empty or missing day is all zero but keeps every category', () => {
    for (const day of [undefined, null, {}]) {
      const s = calculateDaySubtotal(day);
      expect(s.total).toEqual({});
      expect(Object.keys(s.byCategory)).toEqual([
        'food',
        'accommodation',
        'in-city-transport',
        'activities',
        'intercity-transport',
      ]);
    }
  });

  it('adds budget entries, activity costs and transport costs by category', () => {
    const s = calculateDaySubtotal({
      budgetEntries: [
        { category: 'food', amount: 20, currency: 'EUR' },
        { category: 'food', amount: 5.5, currency: 'EUR' },
        { category: 'activities', amount: 10, currency: 'EUR' },
      ],
      activities: [{ cost: 15, currency: 'EUR' }, { cost: undefined }],
      transportCosts: [{ amount: 79.9, currency: 'EUR' }],
    });
    expect(s.byCategory.food).toEqual({ EUR: 25.5 });
    expect(s.byCategory.activities).toEqual({ EUR: 25 }); // 10 entry + 15 activity cost
    expect(s.byCategory['intercity-transport']).toEqual({ EUR: 79.9 });
    expect(s.total).toEqual({ EUR: 130.4 });
  });

  it('keeps currencies apart and never mixes them', () => {
    const s = calculateDaySubtotal({
      budgetEntries: [
        { category: 'food', amount: 10, currency: 'EUR' },
        { category: 'food', amount: 20, currency: 'usd' },
      ],
    });
    expect(s.total).toEqual({ EUR: 10, USD: 20 });
  });

  it('is exact with decimals (no floating point drift)', () => {
    const s = calculateDaySubtotal({
      budgetEntries: [
        { category: 'food', amount: 0.1, currency: 'EUR' },
        { category: 'food', amount: 0.2, currency: 'EUR' },
      ],
    });
    expect(s.total.EUR).toBe(0.3);
  });

  it('puts an activity cost without a valid currency under UNSPECIFIED', () => {
    const s = calculateDaySubtotal({
      activities: [{ cost: 12 }, { cost: 3, currency: 'Euro' }, { cost: 5, currency: 'eur' }],
    });
    expect(s.total).toEqual({ EUR: 5, [UNSPECIFIED_CURRENCY]: 15 });
  });

  it('ignores negative, zero, NaN and non-number amounts and unknown categories', () => {
    const s = calculateDaySubtotal({
      budgetEntries: [
        { category: 'food', amount: -5, currency: 'EUR' },
        { category: 'food', amount: 0, currency: 'EUR' },
        { category: 'food', amount: NaN, currency: 'EUR' },
        { category: 'food', amount: '9' as unknown as number, currency: 'EUR' },
        { category: 'shopping', amount: 9, currency: 'EUR' },
      ],
    });
    expect(s.total).toEqual({});
  });

  it('sums a group of days (consecutive days in the same city)', () => {
    const s = calculateDaysSubtotal([
      { budgetEntries: [{ category: 'food', amount: 10, currency: 'EUR' }] },
      { budgetEntries: [{ category: 'accommodation', amount: 80, currency: 'EUR' }] },
      { transportCosts: [{ amount: 30, currency: 'USD' }] },
    ]);
    expect(s.total).toEqual({ EUR: 90, USD: 30 });
    expect(s.byCategory.accommodation).toEqual({ EUR: 80 });
    expect(calculateDaysSubtotal([]).total).toEqual({});
    expect(calculateDaysSubtotal(undefined).total).toEqual({});
  });

  it('normalizes currency codes', () => {
    expect(normalizeCurrency(' eur ')).toBe('EUR');
    expect(normalizeCurrency('EURO')).toBe(UNSPECIFIED_CURRENCY);
    expect(normalizeCurrency(undefined)).toBe(UNSPECIFIED_CURRENCY);
    expect(normalizeCurrency(5)).toBe(UNSPECIFIED_CURRENCY);
  });
});

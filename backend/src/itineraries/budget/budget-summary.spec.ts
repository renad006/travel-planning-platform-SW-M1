import { buildBudgetSummary } from './budget-summary';

// 1 USD = 0.5 EUR = 50 EGP
const rates = { USD: 1, EUR: 0.5, EGP: 50 };

const days = [
  {
    _id: 'd1',
    dayNumber: 1,
    city: 'Cairo',
    budgetEntries: [
      { category: 'food', amount: 10, currency: 'EUR' },
      { category: 'accommodation', amount: 100, currency: 'USD' },
    ],
    activities: [{ cost: 20, currency: 'USD' }],
    transportCosts: [],
  },
  {
    _id: 'd2',
    dayNumber: 2,
    city: 'Luxor',
    budgetEntries: [{ category: 'food', amount: 500, currency: 'EGP' }],
    activities: [{ cost: 5 }], // no currency
    transportCosts: [{ amount: 40, currency: 'XYZ' }], // no rate
  },
];

describe('buildBudgetSummary', () => {
  it('converts the whole itinerary into the target currency', () => {
    const s = buildBudgetSummary(days, rates, 'USD');
    // 10 EUR = 20 USD, 500 EGP = 10 USD, plus 100 + 20 USD
    expect(s.total.amount).toBe(150);
    expect(s.total.currency).toBe('USD');
    expect(s.byCategory.food.amount).toBe(30);
    expect(s.byCategory.accommodation.amount).toBe(100);
    expect(s.byCategory.activities.amount).toBe(20);
  });

  it('never guesses: no rate or no currency stays unconverted', () => {
    const s = buildBudgetSummary(days, rates, 'USD');
    expect(s.total.unconverted).toEqual({ UNSPECIFIED: 5, XYZ: 40 });
    expect(s.byCategory.activities.unconverted).toEqual({ UNSPECIFIED: 5 });
    expect(s.byCategory['intercity-transport'].unconverted).toEqual({ XYZ: 40 });
  });

  it('gives a total for every day', () => {
    const s = buildBudgetSummary(days, rates, 'EUR');
    expect(s.byDay).toHaveLength(2);
    expect(s.byDay[0]).toMatchObject({ dayId: 'd1', dayNumber: 1, city: 'Cairo' });
    expect(s.byDay[0].total.amount).toBe(70); // 10 EUR + 100 USD + 20 USD
    expect(s.byDay[1].total.amount).toBe(5); // 500 EGP
    expect(s.byDay[1].total.unconverted).toEqual({ UNSPECIFIED: 5, XYZ: 40 });
  });

  it('keeps the original totals per currency', () => {
    const s = buildBudgetSummary(days, rates, 'USD');
    expect(s.originalTotals).toEqual({ EGP: 500, EUR: 10, UNSPECIFIED: 5, USD: 120, XYZ: 40 });
  });

  it('works for an itinerary with no days or no costs', () => {
    expect(buildBudgetSummary([], rates, 'USD').total).toEqual({
      amount: 0,
      currency: 'USD',
      unconverted: {},
    });
    expect(buildBudgetSummary(undefined, rates, 'USD').byDay).toEqual([]);
  });
});

/**
 * ITN-09 / ITN-14: pure budget maths for itinerary days. No database, no framework.
 *
 * What counts towards a day (ITN-14):
 *  - its budget entries, by their own category (food, accommodation, in-city-transport, activities)
 *  - the cost of its activities (ITN-10), counted under "activities"
 *  - its intercity transport costs (ITN-16), counted under "intercity-transport"
 *
 * Money is kept PER CURRENCY, because an itinerary can mix currencies and nothing here may guess
 * an exchange rate. Converting to the user's preferred currency is the job of the FX rates
 * module (ITN-18). Amounts are added in integer cents so 0.1 + 0.2 stays 0.3.
 */
export const BUDGET_CATEGORY_KEYS = [
  'food',
  'accommodation',
  'in-city-transport',
  'activities',
  'intercity-transport',
] as const;
export type BudgetCategoryKey = (typeof BUDGET_CATEGORY_KEYS)[number];

/** Currency code -> amount, for example { EUR: 120.5, USD: 30 }. */
export type Money = Record<string, number>;

export interface Subtotal {
  /** Everything, per currency. */
  total: Money;
  /** The same amounts split by category; every category is always present. */
  byCategory: Record<BudgetCategoryKey, Money>;
}

/** Key used for an amount that has no usable currency (an activity cost without a currency). */
export const UNSPECIFIED_CURRENCY = 'UNSPECIFIED';

/** Only the fields we read, so this works on Mongoose subdocuments and on plain objects. */
export interface BudgetableDay {
  budgetEntries?: ReadonlyArray<{ category?: string; amount?: number; currency?: string }>;
  activities?: ReadonlyArray<{ cost?: number; currency?: string }>;
  transportCosts?: ReadonlyArray<{ amount?: number; currency?: string }>;
}

type Cents = Record<string, number>;
type CentsByCategory = Record<BudgetCategoryKey, Cents>;

const emptyCategories = (): CentsByCategory => ({
  food: {},
  accommodation: {},
  'in-city-transport': {},
  activities: {},
  'intercity-transport': {},
});

export function normalizeCurrency(currency: unknown): string {
  if (typeof currency !== 'string') return UNSPECIFIED_CURRENCY;
  const code = currency.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : UNSPECIFIED_CURRENCY;
}

const isCategory = (value: unknown): value is BudgetCategoryKey =>
  typeof value === 'string' && (BUDGET_CATEGORY_KEYS as readonly string[]).includes(value);

function add(target: Cents, currency: unknown, amount: unknown) {
  // a missing, negative or non-numeric amount counts as nothing instead of breaking the total
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return;
  const code = normalizeCurrency(currency);
  target[code] = (target[code] ?? 0) + Math.round(amount * 100);
}

function fromCents(cents: Cents): Money {
  const out: Money = {};
  for (const code of Object.keys(cents).sort()) out[code] = cents[code] / 100;
  return out;
}

function toSubtotal(byCategory: CentsByCategory): Subtotal {
  const total: Cents = {};
  const categories = {} as Record<BudgetCategoryKey, Money>;
  for (const key of BUDGET_CATEGORY_KEYS) {
    categories[key] = fromCents(byCategory[key]);
    for (const [code, cents] of Object.entries(byCategory[key])) {
      total[code] = (total[code] ?? 0) + cents;
    }
  }
  return { total: fromCents(total), byCategory: categories };
}

function accumulateDay(day: BudgetableDay | null | undefined, into: CentsByCategory) {
  for (const entry of day?.budgetEntries ?? []) {
    if (isCategory(entry.category)) add(into[entry.category], entry.currency, entry.amount);
  }
  for (const activity of day?.activities ?? []) add(into.activities, activity.currency, activity.cost);
  for (const cost of day?.transportCosts ?? []) {
    add(into['intercity-transport'], cost.currency, cost.amount);
  }
}

/** Subtotal of one day. */
export function calculateDaySubtotal(day: BudgetableDay | null | undefined): Subtotal {
  const cents = emptyCategories();
  accumulateDay(day, cents);
  return toSubtotal(cents);
}

/**
 * Subtotal of several days together, for example the group of consecutive days in the same city
 * (ITN-09) or a whole itinerary (ITN-14).
 */
export function calculateDaysSubtotal(days: ReadonlyArray<BudgetableDay> | null | undefined): Subtotal {
  const cents = emptyCategories();
  for (const day of days ?? []) accumulateDay(day, cents);
  return toSubtotal(cents);
}

import { MoneyByCurrency, Rates, convertMoney } from '../../fx-rates/fx-conversion';
import {
  BUDGET_CATEGORY_KEYS,
  BudgetCategoryKey,
  BudgetableDay,
  Money,
  Subtotal,
  calculateDaySubtotal,
  calculateDaysSubtotal,
} from './budget-calculator';

/**
 * ITN-14 / ITN-18: the budget summary of a whole itinerary, converted into one currency.
 * Pure functions: the exchange rates are passed in, so there is no database or network here.
 *
 * A currency the provider has no rate for (and amounts without a currency) are never guessed:
 * they stay in `unconverted`, in their own currency, next to the converted amount.
 */
export interface ConvertedAmount {
  /** Everything that could be converted, in the target currency. */
  amount: number;
  currency: string;
  /** Amounts that could not be converted, still in their own currency. */
  unconverted: MoneyByCurrency;
}

export type ConvertedByCategory = Record<BudgetCategoryKey, ConvertedAmount>;

export interface SummaryDay extends BudgetableDay {
  _id?: unknown;
  dayNumber?: number;
  city?: string;
}

export interface BudgetSummary {
  currency: string;
  total: ConvertedAmount;
  byCategory: ConvertedByCategory;
  byDay: Array<{
    dayId: string | null;
    dayNumber: number | null;
    city: string | null;
    total: ConvertedAmount;
    byCategory: ConvertedByCategory;
  }>;
  /** The total before any conversion, one amount per original currency. */
  originalTotals: Money;
}

function convertSubtotal(rates: Rates, subtotal: Subtotal, to: string) {
  const byCategory = {} as ConvertedByCategory;
  for (const key of BUDGET_CATEGORY_KEYS) {
    byCategory[key] = convertMoney(rates, subtotal.byCategory[key], to);
  }
  return { total: convertMoney(rates, subtotal.total, to), byCategory };
}

export function buildBudgetSummary(
  days: ReadonlyArray<SummaryDay> | null | undefined,
  rates: Rates,
  to: string,
): BudgetSummary {
  const list = days ?? [];
  const whole = calculateDaysSubtotal(list);
  const converted = convertSubtotal(rates, whole, to);

  return {
    currency: to,
    total: converted.total,
    byCategory: converted.byCategory,
    byDay: list.map((day) => {
      const perDay = convertSubtotal(rates, calculateDaySubtotal(day), to);
      return {
        dayId: day._id != null ? String(day._id) : null,
        dayNumber: day.dayNumber ?? null,
        city: day.city ?? null,
        total: perDay.total,
        byCategory: perDay.byCategory,
      };
    }),
    originalTotals: whole.total,
  };
}

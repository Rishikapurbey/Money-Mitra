import type { RecapTotals } from "./recap";

// A whole year (or the year so far), worked out by the server from the user's entries
export interface YearReview {
  year: string;
  inProgress: boolean;
  enoughData: boolean;
  transactionCount: number;
  totals: RecapTotals;
  previous: RecapTotals | null;
  months: { month: string; label: string; income: number; expense: number; saved: number }[];
  bestMonth: { month: string; name: string; saved: number } | null;
  toughestMonth: { month: string; name: string; saved: number } | null;
  categories: { name: string; amount: number; share: number; perMonth: number }[];
  budgets: { category: string; limit: number; monthsWithin: number; monthsCounted: number }[];
  goals: { name: string; savedAmount: number; targetAmount: number; pct: number; added: number }[];
  goalsAdded: number;
  biggestExpense: { amount: number; category: string; note: string | null; date: string } | null;
  noSpendDays: number;
  daysCounted: number;
  highlights: string[];
  // The year of the user's first entry, and the next year that has started; null when there isn't one
  firstYear: string | null;
  nextYear: string | null;
}

// What the January Home card shows
export interface YearSummary {
  year: string;
  totals: RecapTotals;
  highlights: string[];
}

export const isYearKey = (value: string | undefined): value is string => !!value && /^\d{4}$/.test(value);

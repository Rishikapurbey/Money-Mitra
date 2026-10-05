// A look back at a finished month, worked out by the server from the user's entries

export interface RecapTotals {
  income: number;
  expense: number;
  saved: number;
  // Share of income kept, or null without income
  savingsRate: number | null;
}

export interface Recap {
  month: string;
  monthName: string;
  previousMonthName: string;
  enoughData: boolean;
  transactionCount: number;
  totals: RecapTotals;
  previous: RecapTotals | null;
  categories: { name: string; amount: number; share: number; previous: number; changePct: number | null }[];
  budgets: { category: string; limit: number; spent: number; over: boolean }[];
  // `added` is the net amount put into each goal during the month
  goals: { name: string; savedAmount: number; targetAmount: number; pct: number; added: number }[];
  goalsAdded: number;
  biggestExpense: { amount: number; category: string; note: string | null; date: string } | null;
  noSpendDays: number;
  daysInMonth: number;
  recurringTotal: number;
  wentWell: string | null;
  toWatch: string | null;
  learnSlug: string;
  // How net worth moved during the month; null without values from before it
  netWorth: { start: number; end: number; change: number } | null;
  // Bills set to "remind me to pay" that were due in the month; null when there were none
  bills: { onTime: number; total: number } | null;
  // The month of the user's first entry, and the next finished month; null when there isn't one
  firstMonth: string | null;
  nextMonth: string | null;
}

// What the Home card shows
export type RecapSummary = Pick<Recap, "month" | "monthName" | "previousMonthName" | "totals" | "previous" | "wentWell">;

// YYYY-MM for a date in the device's timezone
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function shiftMonth(month: string, by: number) {
  const [year, m] = month.split("-").map(Number);
  return monthKey(new Date(year, m - 1 + by, 1));
}

export const isMonthKey = (value: string | undefined): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

// Percentage change, or null when there's nothing to compare with
export const percentChange = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

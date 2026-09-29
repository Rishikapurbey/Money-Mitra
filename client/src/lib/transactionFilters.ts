import { addMonths, startOfMonth } from "./dates";

// Which dates the Transactions list covers. "month" follows the month picked at the top of the Tracker.
export type RangeKey = "month" | "3m" | "year" | "all" | "custom";

export interface TransactionFilters {
  q: string;
  type: "all" | "income" | "expense";
  category: string; // "all" or a category name
  min: string; // amounts as typed, "" when not set
  max: string;
  range: RangeKey;
  from: string; // YYYY-MM-DD, used when range is "custom"
  to: string;
}

export const DEFAULT_FILTERS: TransactionFilters = {
  q: "",
  type: "all",
  category: "all",
  min: "",
  max: "",
  range: "month",
  from: "",
  to: "",
};

const RANGES: RangeKey[] = ["month", "3m", "year", "all", "custom"];
const KEYS = Object.keys(DEFAULT_FILTERS) as (keyof TransactionFilters)[];

// Filters live in the page URL, so they survive a refresh and the back button
export function filtersFromParams(params: URLSearchParams): TransactionFilters {
  const type = params.get("type");
  const range = params.get("range") as RangeKey | null;
  return {
    q: params.get("q") ?? "",
    type: type === "income" || type === "expense" ? type : "all",
    category: params.get("category") || "all",
    min: params.get("min") ?? "",
    max: params.get("max") ?? "",
    range: range && RANGES.includes(range) ? range : "month",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}

// Only filters that differ from the defaults go in the URL
export function filtersToParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    if (filters[key] !== DEFAULT_FILTERS[key]) params.set(key, filters[key]);
  }
  return params;
}

export const hasActiveFilters = (filters: TransactionFilters) => filtersToParams(filters).toString() !== "";

const amountOf = (value: string) => {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

// Start (inclusive) and end (exclusive) of the chosen range; undefined means open-ended
export function rangeBounds(filters: TransactionFilters, month: Date, now = new Date()): { from?: Date; to?: Date } {
  const thisMonth = startOfMonth(now);
  switch (filters.range) {
    case "month":
      return { from: month, to: addMonths(month, 1) };
    case "3m":
      return { from: addMonths(thisMonth, -2), to: addMonths(thisMonth, 1) };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    case "all":
      return {};
    case "custom": {
      const from = filters.from ? new Date(`${filters.from}T00:00:00`) : undefined;
      // Include the whole of the end day
      const to = filters.to ? new Date(`${filters.to}T00:00:00`) : undefined;
      if (to) to.setDate(to.getDate() + 1);
      return { ...(from && { from }), ...(to && { to }) };
    }
  }
}

// Query parameters for GET /transactions/search
export function searchQuery(filters: TransactionFilters, month: Date, now = new Date()) {
  const { from, to } = rangeBounds(filters, month, now);
  const min = amountOf(filters.min);
  const max = amountOf(filters.max);
  return {
    ...(filters.q.trim() && { q: filters.q.trim() }),
    ...(filters.type !== "all" && { type: filters.type }),
    ...(filters.category !== "all" && { category: filters.category }),
    ...(min !== undefined && { min }),
    ...(max !== undefined && { max }),
    ...(from && { from: from.toISOString() }),
    ...(to && { to: to.toISOString() }),
  };
}

interface Filterable {
  amount: number;
  type: string;
  category: string;
  note?: string | null;
}

// The same rules the server applies, for filtering a month that is already loaded
export function matchesFilters(t: Filterable, filters: TransactionFilters): boolean {
  if (filters.type !== "all" && t.type !== filters.type) return false;
  if (filters.category !== "all" && t.category !== filters.category) return false;
  const min = amountOf(filters.min);
  const max = amountOf(filters.max);
  if (min !== undefined && t.amount < min) return false;
  if (max !== undefined && t.amount > max) return false;
  const q = filters.q.trim().toLowerCase();
  if (q && !t.category.toLowerCase().includes(q) && !(t.note ?? "").toLowerCase().includes(q)) return false;
  return true;
}

export function totalsOf(list: Pick<Filterable, "amount" | "type">[]) {
  return list.reduce(
    (acc, t) => {
      acc.count += 1;
      if (t.type === "income") acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    },
    { count: 0, income: 0, expense: 0 }
  );
}

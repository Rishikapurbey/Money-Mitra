// Things the user owns and owes, valued by hand, and net worth over time

export type ItemKind = "asset" | "liability";

export interface NetWorthItem {
  id: string;
  name: string;
  kind: ItemKind;
  type: string;
  value: number;
  updatedAt: string;
}

export interface NetWorthTotals {
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface NetWorthOverview {
  items: NetWorthItem[];
  totals: NetWorthTotals;
  // Change over the last 30 days, or null when net worth wasn't known then
  changeThisMonth: number | null;
  history: { month: string; netWorth: number }[];
  lastUpdated: string | null;
}

// For the Home card
export interface NetWorthSummary {
  netWorth: number;
  changeThisMonth: number | null;
  lastUpdated: string | null;
  // Values are more than a month old
  stale: boolean;
}

// How net worth moved over a recap's month or a year; null when it wasn't known at the start
export type NetWorthChange = { start: number; end: number; change: number } | null;

// Kept in step with the server's list in networth.ts
export const ITEM_TYPES: Record<ItemKind, { value: string; label: string }[]> = {
  asset: [
    { value: "bank", label: "Bank account" },
    { value: "fd", label: "FD or RD" },
    { value: "investments", label: "Mutual funds and stocks" },
    { value: "retirement", label: "PF, PPF or NPS" },
    { value: "gold", label: "Gold" },
    { value: "property", label: "Property" },
    { value: "cash", label: "Cash" },
    { value: "other", label: "Other" },
  ],
  liability: [
    { value: "home_loan", label: "Home loan" },
    { value: "vehicle_loan", label: "Vehicle loan" },
    { value: "personal_loan", label: "Personal loan" },
    { value: "education_loan", label: "Education loan" },
    { value: "credit_card", label: "Credit card" },
    { value: "borrowed", label: "Money borrowed" },
    { value: "other", label: "Other" },
  ],
};

export const typeLabel = (kind: ItemKind, type: string) => ITEM_TYPES[kind].find((t) => t.value === type)?.label ?? "Other";

// "+₹18,000" or "−₹2,500"
export const signedINR = (n: number) => `${n >= 0 ? "+" : "−"}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;

// A net worth figure, which can be below zero: "₹2,40,000" or "−₹1,50,000"
export const worthINR = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

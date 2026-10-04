// Net worth on any date, from the values the user has recorded. Pure: no database access.

export type ItemKind = "asset" | "liability";

// The kinds of things people own and owe, with the names shown in the app
export const ITEM_TYPES: Record<ItemKind, Record<string, string>> = {
  asset: {
    bank: "Bank account",
    fd: "FD or RD",
    investments: "Mutual funds and stocks",
    retirement: "PF, PPF or NPS",
    gold: "Gold",
    property: "Property",
    cash: "Cash",
    other: "Other",
  },
  liability: {
    home_loan: "Home loan",
    vehicle_loan: "Vehicle loan",
    personal_loan: "Personal loan",
    education_loan: "Education loan",
    credit_card: "Credit card",
    borrowed: "Money borrowed",
    other: "Other",
  },
};

export interface RecordedValue {
  itemId: string;
  kind: string;
  value: number;
  recordedAt: Date;
}

export interface NetWorthTotals {
  assets: number;
  liabilities: number;
  netWorth: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Each item's latest value on or before `at`, added up. Null when nothing had been recorded by then.
export function netWorthAt(values: RecordedValue[], at: Date): NetWorthTotals | null {
  const latest = new Map<string, RecordedValue>();
  for (const v of values) {
    if (v.recordedAt > at) continue;
    const current = latest.get(v.itemId);
    if (!current || v.recordedAt >= current.recordedAt) latest.set(v.itemId, v);
  }
  if (latest.size === 0) return null;
  let assets = 0;
  let liabilities = 0;
  for (const v of latest.values()) {
    if (v.kind === "liability") liabilities += v.value;
    else assets += v.value;
  }
  return { assets: round2(assets), liabilities: round2(liabilities), netWorth: round2(assets - liabilities) };
}

// How net worth moved between two dates, or null when it wasn't known at the start
export function netWorthChange(values: RecordedValue[], from: Date, to: Date) {
  const start = netWorthAt(values, from);
  const end = netWorthAt(values, to);
  if (!start || !end) return null;
  return { start: start.netWorth, end: end.netWorth, change: round2(end.netWorth - start.netWorth) };
}

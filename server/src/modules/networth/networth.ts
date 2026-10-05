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

// Only these can be the main account that Tracker income and expenses flow through
export const MAIN_ACCOUNT_TYPES = ["bank", "cash"];

// The main account and the Tracker's money movements: income positive, expenses negative
export interface MainAccount {
  itemId: string;
  flows: { date: Date; amount: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function latestValues(values: RecordedValue[], at: Date) {
  const latest = new Map<string, RecordedValue>();
  for (const v of values) {
    if (v.recordedAt > at) continue;
    const current = latest.get(v.itemId);
    if (!current || v.recordedAt >= current.recordedAt) latest.set(v.itemId, v);
  }
  return latest;
}

// The main account on `at`: its last typed-in value, plus the Tracker's income and expenses dated
// after that value and up to `at`. Anything dated earlier was already part of the typed-in value.
export function mainAccountAt(values: RecordedValue[], main: MainAccount, at: Date) {
  const recorded = latestValues(values, at).get(main.itemId);
  if (!recorded) return null;
  const change = main.flows.reduce((sum, f) => (f.date > recorded.recordedAt && f.date <= at ? sum + f.amount : sum), 0);
  return { recorded: recorded.value, recordedAt: recorded.recordedAt, change: round2(change), value: round2(recorded.value + change) };
}

// Each item's latest value on or before `at`, added up, with the main account moved by the Tracker.
// Null when nothing had been recorded by then.
export function netWorthAt(values: RecordedValue[], at: Date, main: MainAccount | null = null): NetWorthTotals | null {
  const latest = latestValues(values, at);
  if (latest.size === 0) return null;
  let assets = 0;
  let liabilities = 0;
  for (const v of latest.values()) {
    if (v.kind === "liability") liabilities += v.value;
    else assets += v.value;
  }
  if (main) assets += mainAccountAt(values, main, at)?.change ?? 0;
  return { assets: round2(assets), liabilities: round2(liabilities), netWorth: round2(assets - liabilities) };
}

// How net worth moved between two dates, or null when it wasn't known at the start
export function netWorthChange(values: RecordedValue[], from: Date, to: Date, main: MainAccount | null = null) {
  const start = netWorthAt(values, from, main);
  const end = netWorthAt(values, to, main);
  if (!start || !end) return null;
  return { start: start.netWorth, end: end.netWorth, change: round2(end.netWorth - start.netWorth) };
}

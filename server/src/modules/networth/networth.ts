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

// The items that are accounts: Tracker entries are paid from or received in them, and move their value
export const ACCOUNT_TYPES: Record<ItemKind, string[]> = { asset: ["bank", "cash"], liability: ["credit_card"] };
export const isAccount = (kind: string, type: string) => ACCOUNT_TYPES[kind as ItemKind]?.includes(type) ?? false;

// A Tracker entry's effect on its account's value
export interface AccountFlow {
  date: Date;
  amount: number;
}

// Money in raises a bank or cash balance; on a credit card, spending raises what's owed and refunds lower it
export const flowAmount = (kind: string, type: string, amount: number) =>
  (type === "income") === (kind !== "liability") ? amount : -amount;

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

const changeAfter = (flows: AccountFlow[] | undefined, after: Date, at: Date) =>
  round2((flows ?? []).reduce((sum, f) => (f.date > after && f.date <= at ? sum + f.amount : sum), 0));

// An account on `at`: its last typed-in value, plus its Tracker entries dated after that value and up
// to `at`. Anything dated earlier was already part of the typed-in value.
export function accountAt(values: RecordedValue[], itemId: string, flows: Map<string, AccountFlow[]>, at: Date) {
  const recorded = latestValues(values, at).get(itemId);
  if (!recorded) return null;
  const change = changeAfter(flows.get(itemId), recorded.recordedAt, at);
  return { recorded: recorded.value, recordedAt: recorded.recordedAt, change, value: round2(recorded.value + change) };
}

// Each item's latest value on or before `at`, added up, with accounts moved by their Tracker entries.
// Null when nothing had been recorded by then.
export function netWorthAt(values: RecordedValue[], at: Date, flows: Map<string, AccountFlow[]> = new Map()): NetWorthTotals | null {
  const latest = latestValues(values, at);
  if (latest.size === 0) return null;
  let assets = 0;
  let liabilities = 0;
  for (const v of latest.values()) {
    const value = v.value + changeAfter(flows.get(v.itemId), v.recordedAt, at);
    if (v.kind === "liability") liabilities += value;
    else assets += value;
  }
  return { assets: round2(assets), liabilities: round2(liabilities), netWorth: round2(assets - liabilities) };
}

// How net worth moved between two dates, or null when it wasn't known at the start
export function netWorthChange(values: RecordedValue[], from: Date, to: Date, flows: Map<string, AccountFlow[]> = new Map()) {
  const start = netWorthAt(values, from, flows);
  const end = netWorthAt(values, to, flows);
  if (!start || !end) return null;
  return { start: start.netWorth, end: end.netWorth, change: round2(end.netWorth - start.netWorth) };
}

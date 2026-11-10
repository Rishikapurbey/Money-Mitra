import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { localMonth } from "../budgets/budgetAlert.service";
import { accountAt, flowAmount, isAccount, netWorthAt, netWorthChange } from "./networth";
import type { AccountFlow, ItemKind, RecordedValue } from "./networth";

const DAY = 24 * 60 * 60 * 1000;
// Values older than this count as out of date, and the reminder can be sent again after this long
const STALE_DAYS = 30;
const HISTORY_MONTHS = 24;
const ITEM_HISTORY_LIMIT = 20;

export interface ItemInput {
  name: string;
  kind: ItemKind;
  type: string;
  value: number;
  isDefault?: boolean;
  creditLimit?: number | null;
}

// Only a credit card has a limit
const limitFor = (type: string, creditLimit: number | null | undefined) => (type === "credit_card" ? (creditLimit ?? null) : null);

async function findOwned(userId: string, id: string) {
  const item = await prisma.netWorthItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId || item.archivedAt) throw new HttpError(404, "Item not found");
  return item;
}

async function recordedValues(userId: string): Promise<RecordedValue[]> {
  const values = await prisma.netWorthValue.findMany({
    where: { userId },
    orderBy: { recordedAt: "asc" },
    select: { itemId: true, value: true, recordedAt: true, item: { select: { kind: true } } },
  });
  return values.map((v) => ({ itemId: v.itemId, kind: v.item.kind, value: v.value, recordedAt: v.recordedAt }));
}

// Each account's Tracker entries and transfers, as their effect on its value. Anything dated after an
// account was removed doesn't count, since it's worth zero from then on.
async function accountFlows(userId: string) {
  const accounts = await prisma.netWorthItem.findMany({ where: { userId }, select: { id: true, kind: true, type: true, archivedAt: true } });
  const live = accounts.filter((a) => isAccount(a.kind, a.type));
  const byId = new Map(live.map((a) => [a.id, a]));
  const flows = new Map<string, AccountFlow[]>();
  if (live.length === 0) return flows;
  const ids = live.map((a) => a.id);
  const [transactions, transfers] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, accountId: { in: ids } },
      select: { accountId: true, date: true, amount: true, type: true },
    }),
    prisma.transfer.findMany({ where: { userId }, select: { fromId: true, toId: true, date: true, amount: true } }),
  ]);
  const push = (accountId: string, date: Date, type: string, amount: number) => {
    const account = byId.get(accountId);
    if (!account || (account.archivedAt && date > account.archivedAt)) return;
    const list = flows.get(account.id) ?? [];
    list.push({ date, amount: flowAmount(account.kind, type, amount) });
    flows.set(account.id, list);
  };
  for (const t of transactions) push(t.accountId as string, t.date, t.type, t.amount);
  // A transfer leaves one account like spending and arrives in the other like income
  for (const t of transfers) {
    push(t.fromId, t.date, "expense", t.amount);
    push(t.toId, t.date, "income", t.amount);
  }
  return flows;
}

async function netWorthData(userId: string) {
  const [values, flows] = await Promise.all([recordedValues(userId), accountFlows(userId)]);
  return { values, flows };
}

// Net worth at the end of each month (today for the current one), from the first recorded value
function monthlyHistory(values: RecordedValue[], flows: Map<string, AccountFlow[]>, tzOffset: number, now: Date) {
  const first = values[0];
  if (!first) return [];
  const points: { month: string; netWorth: number }[] = [];
  let month = localMonth(now, tzOffset);
  for (let i = 0; i < HISTORY_MONTHS && month.to > first.recordedAt; i++) {
    const at = month.to < now ? new Date(month.to.getTime() - 1) : now;
    const totals = netWorthAt(values, at, flows);
    if (totals) points.unshift({ month: month.key, netWorth: totals.netWorth });
    month = localMonth(new Date(month.from.getTime() - 1), tzOffset);
  }
  return points;
}

export async function getNetWorth(userId: string, tzOffset: number, now = new Date()) {
  const [items, { values, flows }] = await Promise.all([
    prisma.netWorthItem.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true, type: true, value: true, isDefault: true, creditLimit: true, createdAt: true },
    }),
    netWorthData(userId),
  ]);
  const lastValue = new Map<string, Date>();
  for (const v of values) lastValue.set(v.itemId, v.recordedAt);
  const totals = netWorthAt(values, now, flows) ?? { assets: 0, liabilities: 0, netWorth: 0 };
  const monthAgo = netWorthChange(values, new Date(now.getTime() - STALE_DAYS * DAY), now, flows);
  const lastUpdated = values.length > 0 ? values[values.length - 1]!.recordedAt : null;
  return {
    items: items.map((i) => {
      // An account shows its typed-in value moved by its Tracker entries since then
      const account = isAccount(i.kind, i.type);
      const tracked = account ? accountAt(values, i.id, flows, now) : null;
      return {
        ...i,
        isAccount: account,
        value: tracked?.value ?? i.value,
        tracked: tracked && { recorded: tracked.recorded, change: tracked.change },
        updatedAt: lastValue.get(i.id) ?? i.createdAt,
      };
    }),
    totals,
    changeThisMonth: monthAgo?.change ?? null,
    history: monthlyHistory(values, flows, tzOffset, now),
    lastUpdated,
  };
}

// The first account someone adds becomes their default, so new Tracker entries start with it
export async function createItem(userId: string, input: ItemInput) {
  const account = isAccount(input.kind, input.type);
  return prisma.$transaction(async (tx) => {
    const hasDefault = account && (await tx.netWorthItem.count({ where: { userId, isDefault: true, archivedAt: null } })) > 0;
    const isDefault = account && (input.isDefault === true || !hasDefault);
    if (isDefault) await tx.netWorthItem.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    const item = await tx.netWorthItem.create({
      data: {
        userId,
        name: input.name,
        kind: input.kind,
        type: input.type,
        value: input.value,
        isDefault,
        creditLimit: limitFor(input.type, input.creditLimit),
      },
    });
    await tx.netWorthValue.create({ data: { userId, itemId: item.id, value: input.value } });
    return item;
  });
}

export async function updateItem(userId: string, id: string, data: { name: string; type: string; creditLimit?: number | null | undefined }) {
  const item = await findOwned(userId, id);
  const { creditLimit, ...fields } = data;
  return prisma.netWorthItem.update({
    where: { id },
    data: {
      ...fields,
      // Only an account can stay the default, and only a card keeps a limit
      ...(!isAccount(item.kind, data.type) && { isDefault: false }),
      ...(creditLimit !== undefined || data.type !== "credit_card" ? { creditLimit: limitFor(data.type, creditLimit) } : {}),
    },
  });
}

// Makes an account the one new Tracker entries start with (or stops it being that)
export async function setDefault(userId: string, id: string, isDefault: boolean) {
  const item = await findOwned(userId, id);
  if (isDefault && !isAccount(item.kind, item.type)) {
    throw new HttpError(400, "Only a bank account, cash or a credit card can be your default account");
  }
  await prisma.$transaction([
    ...(isDefault ? [prisma.netWorthItem.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })] : []),
    prisma.netWorthItem.update({ where: { id }, data: { isDefault } }),
  ]);
}

// Bank accounts, cash and credit cards with their balances now, for choosing where money went
export async function listAccounts(userId: string, now = new Date()) {
  const [items, { values, flows }] = await Promise.all([
    prisma.netWorthItem.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { kind: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true, type: true, value: true, isDefault: true, creditLimit: true },
    }),
    netWorthData(userId),
  ]);
  return items
    .filter((i) => isAccount(i.kind, i.type))
    .map((i) => ({ ...i, value: accountAt(values, i.id, flows, now)?.value ?? i.value }));
}

// Something worth telling the user after money moves in an account: a bank account or cash below
// zero, or a credit card at 80% of its limit or over it. Null when all is well.
export async function accountAlert(userId: string, accountId: string | null) {
  if (!accountId) return null;
  const account = (await listAccounts(userId)).find((a) => a.id === accountId);
  if (!account) return null;
  const base = { accountId: account.id, name: account.name, value: account.value };
  if (account.kind === "asset") return account.value < 0 ? { kind: "overdrawn" as const, ...base } : null;
  const limit = account.creditLimit;
  if (!limit) return null;
  if (account.value > limit) return { kind: "over_limit" as const, ...base, limit };
  return account.value >= limit * 0.8 ? { kind: "near_limit" as const, ...base, limit } : null;
}

// The account a new entry goes to when none is chosen: the default, if there is one
export async function defaultAccountId(userId: string) {
  const item = await prisma.netWorthItem.findFirst({ where: { userId, isDefault: true, archivedAt: null }, select: { id: true } });
  return item?.id ?? null;
}

// Checks an account chosen for an entry belongs to the user and is still an account
export async function checkAccount(userId: string, accountId: string) {
  const item = await prisma.netWorthItem.findUnique({ where: { id: accountId }, select: { userId: true, kind: true, type: true, archivedAt: true } });
  if (!item || item.userId !== userId || item.archivedAt || !isAccount(item.kind, item.type)) {
    throw new HttpError(400, "Choose one of your accounts");
  }
}

// A new value for an item from today on; earlier values stay as they were
export async function recordValue(userId: string, id: string, value: number) {
  await findOwned(userId, id);
  const [item] = await prisma.$transaction([
    prisma.netWorthItem.update({ where: { id }, data: { value } }),
    prisma.netWorthValue.create({ data: { userId, itemId: id, value } }),
  ]);
  return item;
}

// Counts as zero from today and is hidden; past net worth is unchanged
export async function removeItem(userId: string, id: string) {
  const item = await findOwned(userId, id);
  await prisma.$transaction([
    // Accounts always get a zero, since their entries may have moved them away from the stored value
    ...(item.value !== 0 || isAccount(item.kind, item.type) ? [prisma.netWorthValue.create({ data: { userId, itemId: id, value: 0 } })] : []),
    prisma.netWorthItem.update({ where: { id }, data: { value: 0, isDefault: false, archivedAt: new Date() } }),
  ]);
}

export async function itemHistory(userId: string, id: string) {
  await findOwned(userId, id);
  return prisma.netWorthValue.findMany({
    where: { itemId: id },
    orderBy: { recordedAt: "desc" },
    take: ITEM_HISTORY_LIMIT,
    select: { id: true, value: true, recordedAt: true },
  });
}

// For the Home card: the headline numbers, and a monthly reminder in the bell when values are
// more than a month old. `notified` means the reminder was created just now.
export async function netWorthSummary(userId: string, tzOffset: number, now = new Date()) {
  const itemCount = await prisma.netWorthItem.count({ where: { userId, archivedAt: null } });
  if (itemCount === 0) return { summary: null, notified: false };
  const { totals, changeThisMonth, lastUpdated } = await getNetWorth(userId, tzOffset, now);
  const stale = !lastUpdated || now.getTime() - lastUpdated.getTime() > STALE_DAYS * DAY;

  let notified = false;
  if (stale) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { netWorthReminder: true } });
    // One reminder since the last update, and at most one a month
    const since = Math.max(lastUpdated?.getTime() ?? 0, now.getTime() - STALE_DAYS * DAY);
    const recent = await prisma.notification.findFirst({
      where: { userId, kind: "networth_reminder", createdAt: { gt: new Date(since) } },
    });
    if (user?.netWorthReminder && !recent) {
      await prisma.notification.create({ data: { userId, kind: "networth_reminder", title: "", createdAt: now } });
      notified = true;
    }
  }
  return { summary: { netWorth: totals.netWorth, changeThisMonth, lastUpdated, stale }, notified };
}

// Each account over a period, for the monthly recap and yearly review: money in (income and transfers
// in), money out (spending and transfers out) and its balance at the end. Accounts added after the
// period, or removed before it, are left out; so are ones with no balance known by its end.
export async function accountsOver(userId: string, from: Date, to: Date) {
  const range = { gte: from, lt: to };
  const [items, { values, flows }, sums, transfers] = await Promise.all([
    prisma.netWorthItem.findMany({
      where: { userId, createdAt: { lt: to }, OR: [{ archivedAt: null }, { archivedAt: { gte: from } }] },
      orderBy: [{ isDefault: "desc" }, { kind: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true, type: true },
    }),
    netWorthData(userId),
    prisma.transaction.groupBy({ by: ["accountId", "type"], where: { userId, accountId: { not: null }, date: range }, _sum: { amount: true } }),
    prisma.transfer.findMany({ where: { userId, date: range }, select: { fromId: true, toId: true, amount: true } }),
  ]);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const sumOf = (id: string, type: string) => sums.find((s) => s.accountId === id && s.type === type)?._sum.amount ?? 0;
  const moved = (pick: (t: (typeof transfers)[number]) => boolean) => transfers.filter(pick).reduce((sum, t) => sum + t.amount, 0);
  const end = new Date(to.getTime() - 1);
  return items
    .filter((i) => isAccount(i.kind, i.type))
    .map((i) => ({
      ...i,
      moneyIn: round2(sumOf(i.id, "income") + moved((t) => t.toId === i.id)),
      moneyOut: round2(sumOf(i.id, "expense") + moved((t) => t.fromId === i.id)),
      balance: accountAt(values, i.id, flows, end)?.value ?? null,
    }))
    .filter((a) => a.balance !== null);
}

// How net worth moved over a period, for the monthly recap and yearly review
export async function netWorthOver(userId: string, from: Date, to: Date) {
  const { values, flows } = await netWorthData(userId);
  return netWorthChange(values, from, to, flows);
}

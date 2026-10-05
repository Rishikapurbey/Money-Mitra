import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { localMonth } from "../budgets/budgetAlert.service";
import { MAIN_ACCOUNT_TYPES, mainAccountAt, netWorthAt, netWorthChange } from "./networth";
import type { ItemKind, MainAccount, RecordedValue } from "./networth";

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
}

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

// The main account, if there is one, with the Tracker's income and expenses since its first value
async function mainAccount(userId: string, values: RecordedValue[]): Promise<MainAccount | null> {
  const item = await prisma.netWorthItem.findFirst({ where: { userId, isMain: true, archivedAt: null }, select: { id: true } });
  const first = item && values.find((v) => v.itemId === item.id);
  if (!item || !first) return null;
  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gt: first.recordedAt } },
    select: { date: true, amount: true, type: true },
  });
  return { itemId: item.id, flows: transactions.map((t) => ({ date: t.date, amount: t.type === "income" ? t.amount : -t.amount })) };
}

async function netWorthData(userId: string) {
  const values = await recordedValues(userId);
  return { values, main: await mainAccount(userId, values) };
}

// Net worth at the end of each month (today for the current one), from the first recorded value
function monthlyHistory(values: RecordedValue[], main: MainAccount | null, tzOffset: number, now: Date) {
  const first = values[0];
  if (!first) return [];
  const points: { month: string; netWorth: number }[] = [];
  let month = localMonth(now, tzOffset);
  for (let i = 0; i < HISTORY_MONTHS && month.to > first.recordedAt; i++) {
    const at = month.to < now ? new Date(month.to.getTime() - 1) : now;
    const totals = netWorthAt(values, at, main);
    if (totals) points.unshift({ month: month.key, netWorth: totals.netWorth });
    month = localMonth(new Date(month.from.getTime() - 1), tzOffset);
  }
  return points;
}

export async function getNetWorth(userId: string, tzOffset: number, now = new Date()) {
  const [items, { values, main }] = await Promise.all([
    prisma.netWorthItem.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true, type: true, value: true, isMain: true, createdAt: true },
    }),
    netWorthData(userId),
  ]);
  const lastValue = new Map<string, Date>();
  for (const v of values) lastValue.set(v.itemId, v.recordedAt);
  const totals = netWorthAt(values, now, main) ?? { assets: 0, liabilities: 0, netWorth: 0 };
  const monthAgo = netWorthChange(values, new Date(now.getTime() - STALE_DAYS * DAY), now, main);
  const lastUpdated = values.length > 0 ? values[values.length - 1]!.recordedAt : null;
  return {
    items: items.map((i) => {
      // The main account shows its typed-in value moved by the Tracker since then
      const tracked = main?.itemId === i.id ? mainAccountAt(values, main, now) : null;
      return {
        ...i,
        value: tracked?.value ?? i.value,
        tracked: tracked && { recorded: tracked.recorded, change: tracked.change },
        updatedAt: lastValue.get(i.id) ?? i.createdAt,
      };
    }),
    totals,
    changeThisMonth: monthAgo?.change ?? null,
    history: monthlyHistory(values, main, tzOffset, now),
    lastUpdated,
  };
}

export async function createItem(userId: string, input: ItemInput) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.netWorthItem.create({ data: { userId, name: input.name, kind: input.kind, type: input.type, value: input.value } });
    await tx.netWorthValue.create({ data: { userId, itemId: item.id, value: input.value } });
    return item;
  });
}

export async function updateItem(userId: string, id: string, data: { name: string; type: string }) {
  await findOwned(userId, id);
  // Only a bank account or cash can stay the main account
  return prisma.netWorthItem.update({ where: { id }, data: { ...data, ...(!MAIN_ACCOUNT_TYPES.includes(data.type) && { isMain: false }) } });
}

// Makes an item the account Tracker income and expenses flow through (or stops it being one)
export async function setMain(userId: string, id: string, isMain: boolean) {
  const item = await findOwned(userId, id);
  if (isMain && (item.kind !== "asset" || !MAIN_ACCOUNT_TYPES.includes(item.type))) {
    throw new HttpError(400, "Only a bank account or cash can be your main account");
  }
  await prisma.$transaction([
    ...(isMain ? [prisma.netWorthItem.updateMany({ where: { userId, isMain: true }, data: { isMain: false } })] : []),
    prisma.netWorthItem.update({ where: { id }, data: { isMain } }),
  ]);
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
    ...(item.value !== 0 || item.isMain ? [prisma.netWorthValue.create({ data: { userId, itemId: id, value: 0 } })] : []),
    prisma.netWorthItem.update({ where: { id }, data: { value: 0, isMain: false, archivedAt: new Date() } }),
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

// How net worth moved over a period, for the monthly recap and yearly review
export async function netWorthOver(userId: string, from: Date, to: Date) {
  const { values, main } = await netWorthData(userId);
  return netWorthChange(values, from, to, main);
}

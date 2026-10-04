import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { localMonth } from "../budgets/budgetAlert.service";
import { netWorthAt, netWorthChange } from "./networth";
import type { ItemKind, RecordedValue } from "./networth";

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

// Net worth at the end of each month (today for the current one), from the first recorded value
function monthlyHistory(values: RecordedValue[], tzOffset: number, now: Date) {
  const first = values[0];
  if (!first) return [];
  const points: { month: string; netWorth: number }[] = [];
  let month = localMonth(now, tzOffset);
  for (let i = 0; i < HISTORY_MONTHS && month.to > first.recordedAt; i++) {
    const at = month.to < now ? new Date(month.to.getTime() - 1) : now;
    const totals = netWorthAt(values, at);
    if (totals) points.unshift({ month: month.key, netWorth: totals.netWorth });
    month = localMonth(new Date(month.from.getTime() - 1), tzOffset);
  }
  return points;
}

export async function getNetWorth(userId: string, tzOffset: number, now = new Date()) {
  const [items, values] = await Promise.all([
    prisma.netWorthItem.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true, type: true, value: true, createdAt: true },
    }),
    recordedValues(userId),
  ]);
  const lastValue = new Map<string, Date>();
  for (const v of values) lastValue.set(v.itemId, v.recordedAt);
  const totals = netWorthAt(values, now) ?? { assets: 0, liabilities: 0, netWorth: 0 };
  const monthAgo = netWorthChange(values, new Date(now.getTime() - STALE_DAYS * DAY), now);
  const lastUpdated = values.length > 0 ? values[values.length - 1]!.recordedAt : null;
  return {
    items: items.map((i) => ({ ...i, updatedAt: lastValue.get(i.id) ?? i.createdAt })),
    totals,
    changeThisMonth: monthAgo?.change ?? null,
    history: monthlyHistory(values, tzOffset, now),
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
  return prisma.netWorthItem.update({ where: { id }, data });
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
    ...(item.value !== 0 ? [prisma.netWorthValue.create({ data: { userId, itemId: id, value: 0 } })] : []),
    prisma.netWorthItem.update({ where: { id }, data: { value: 0, archivedAt: new Date() } }),
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
  return netWorthChange(await recordedValues(userId), from, to);
}

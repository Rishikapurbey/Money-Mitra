import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { computeInsights } from "./insights";
import { rememberCategory } from "../categories/category.service";

export interface DateRange {
  from?: Date | undefined;
  to?: Date | undefined;
}

function dateFilter(range: DateRange) {
  if (!range.from && !range.to) return {};
  return { date: { ...(range.from && { gte: range.from }), ...(range.to && { lt: range.to }) } };
}

export async function createTransaction(
  userId: string,
  amount: number,
  type: string,
  category: string,
  note?: string | null,
  date?: Date
) {
  const saved = await rememberCategory(userId, type, category);
  return prisma.transaction.create({
    data: { userId, amount, type, category: saved, note: note ?? null, ...(date && { date }) },
  });
}

export async function getTransactions(userId: string, range: DateRange = {}) {
  return prisma.transaction.findMany({
    where: { userId, ...dateFilter(range) },
    orderBy: { date: "desc" },
  });
}

export interface TransactionSearch {
  range: DateRange;
  q?: string | undefined;
  type?: "income" | "expense" | undefined;
  category?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
}

export const SEARCH_PAGE_SIZE = 50;

// One page of matching transactions (newest first), plus totals for every match, not just this page
export async function searchTransactions(userId: string, search: TransactionSearch, cursor?: string) {
  const { range, q, type, category, min, max } = search;
  const where = {
    userId,
    ...dateFilter(range),
    ...(type && { type }),
    ...(category && { category }),
    ...((min !== undefined || max !== undefined) && {
      amount: { ...(min !== undefined && { gte: min }), ...(max !== undefined && { lte: max }) },
    }),
    ...(q && {
      OR: [
        { note: { contains: q, mode: "insensitive" as const } },
        { category: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [rows, groups] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: SEARCH_PAGE_SIZE + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    }),
    prisma.transaction.groupBy({ by: ["type"], where, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  const totals = { count: 0, income: 0, expense: 0 };
  for (const g of groups) {
    totals.count += g._count._all;
    if (g.type === "income") totals.income += g._sum.amount ?? 0;
    else totals.expense += g._sum.amount ?? 0;
  }
  const hasMore = rows.length > SEARCH_PAGE_SIZE;
  const transactions = hasMore ? rows.slice(0, SEARCH_PAGE_SIZE) : rows;
  return { transactions, totals, nextCursor: hasMore ? transactions[transactions.length - 1]!.id : null };
}

// Every category the user has ever used, for filter dropdowns
export async function getCategories(userId: string) {
  const rows = await prisma.transaction.findMany({
    where: { userId },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

export async function getSummary(userId: string, range: DateRange = {}) {
  const all = await prisma.transaction.findMany({ where: { userId } });
  const net = (list: typeof all) =>
    list.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);

  const inRange = all.filter(
    (t) => (!range.from || t.date >= range.from) && (!range.to || t.date < range.to)
  );
  const income = inRange.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expense = inRange.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense, totalBalance: net(all) };
}

// Income and expense per month, bucketed in the client's timezone.
// tzOffset is the value of JS Date.getTimezoneOffset() on the client (e.g. -330 for IST).
export async function getTrend(userId: string, from: Date, tzOffset: number) {
  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: from } },
  });

  const buckets: Record<string, { month: string; income: number; expense: number }> = {};
  const cursor = new Date(from.getTime() - tzOffset * 60_000);
  const now = new Date(Date.now() - tzOffset * 60_000);
  while (cursor <= now) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets[key] = { month: key, income: 0, expense: 0 };
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }

  for (const t of transactions) {
    const local = new Date(t.date.getTime() - tzOffset * 60_000);
    const key = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets[key];
    if (!bucket) continue;
    if (t.type === "income") bucket.income += t.amount;
    else bucket.expense += t.amount;
  }

  return Object.values(buckets);
}

export async function deleteTransaction(userId: string, id: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.userId !== userId) throw new HttpError(404, "Transaction not found");
  if (transaction.shareId) throw new HttpError(400, "This is your share of a group expense. Remove it from the group instead.");
  return prisma.transaction.delete({ where: { id } });
}

export async function updateTransaction(
  userId: string,
  id: string,
  data: { amount?: number; type?: string; category?: string; note?: string | null; date?: Date | undefined }
) {
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.userId !== userId) throw new HttpError(404, "Transaction not found");
  // A share of a group expense follows the group: only its category and note are the user's own
  if (transaction.shareId) data = { ...(data.category !== undefined && { category: data.category }), ...(data.note !== undefined && { note: data.note }) };
  const { date, ...rest } = data;
  const category = await rememberCategory(userId, rest.type ?? transaction.type, rest.category ?? transaction.category);
  return prisma.transaction.update({ where: { id }, data: { ...rest, category, ...(date && { date }) } });
}

// Plain-English observations about [from, to), compared with the month before it ([prevFrom, from)).
// tzOffset is the client's Date.getTimezoneOffset(), used to name the previous month correctly.
export async function getInsights(userId: string, from: Date, to: Date, prevFrom: Date, tzOffset: number) {
  const [transactions, budgets] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: prevFrom, lt: to } },
      select: { amount: true, type: true, category: true, date: true },
    }),
    prisma.budget.findMany({ where: { userId }, select: { category: true, amount: true } }),
  ]);
  const previousMonthName = new Date(prevFrom.getTime() - tzOffset * 60_000).toLocaleString("en-IN", {
    month: "long",
    timeZone: "UTC",
  });
  return computeInsights({
    current: transactions.filter((t) => t.date >= from),
    previous: transactions.filter((t) => t.date < from),
    budgets,
    from,
    to,
    now: new Date(),
    previousMonthName,
  });
}

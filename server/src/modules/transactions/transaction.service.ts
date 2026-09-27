import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";

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
  return prisma.transaction.create({
    data: { userId, amount, type, category, note: note ?? null, ...(date && { date }) },
  });
}

export async function getTransactions(userId: string, range: DateRange = {}) {
  return prisma.transaction.findMany({
    where: { userId, ...dateFilter(range) },
    orderBy: { date: "desc" },
  });
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
  return prisma.transaction.delete({ where: { id } });
}

export async function updateTransaction(
  userId: string,
  id: string,
  data: { amount?: number; type?: string; category?: string; note?: string | null; date?: Date | undefined }
) {
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.userId !== userId) throw new HttpError(404, "Transaction not found");
  const { date, ...rest } = data;
  return prisma.transaction.update({ where: { id }, data: { ...rest, ...(date && { date }) } });
}

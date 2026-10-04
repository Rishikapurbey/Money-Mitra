import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { localMonth } from "../budgets/budgetAlert.service";
import { MIN_TRANSACTIONS, computeRecap } from "./recap";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// The recap card stays on Home for the first week of the month
const CARD_DAYS = 7;

export const isMonthKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const parts = (month: string) => {
  const [year = 1970, m = 1] = month.split("-").map(Number);
  return [year, m] as const;
};

export function shiftMonth(month: string, by: number) {
  const [year, m] = parts(month);
  const d = new Date(Date.UTC(year, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// A month (YYYY-MM) in the user's timezone. tzOffset is the client's Date.getTimezoneOffset().
export function monthBounds(month: string, tzOffset: number) {
  const [year, m] = parts(month);
  const start = Date.UTC(year, m - 1, 1);
  return {
    from: new Date(start + tzOffset * MINUTE),
    to: new Date(Date.UTC(year, m, 1) + tzOffset * MINUTE),
    name: new Date(start).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
    shortName: new Date(start).toLocaleString("en-IN", { month: "long", timeZone: "UTC" }),
  };
}

// The local month of the user's first entry, so the recap page knows how far back to go
async function firstMonth(userId: string, tzOffset: number) {
  const first = await prisma.transaction.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } });
  return first ? localMonth(first.date, tzOffset).key : null;
}

// The recap for a month that has finished
export async function getRecap(userId: string, month: string, tzOffset: number, now = new Date()) {
  const currentMonth = localMonth(now, tzOffset).key;
  if (month >= currentMonth) throw new HttpError(400, "This month isn't over yet");
  const bounds = monthBounds(month, tzOffset);
  const prevBounds = monthBounds(shiftMonth(month, -1), tzOffset);

  const [transactions, budgets, goals, earliest] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: prevBounds.from, lt: bounds.to } },
      select: { amount: true, type: true, category: true, note: true, date: true, recurringId: true },
    }),
    prisma.budget.findMany({ where: { userId }, select: { category: true, amount: true } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { name: true, savedAmount: true, targetAmount: true } }),
    firstMonth(userId, tzOffset),
  ]);

  const recap = computeRecap({
    month,
    from: bounds.from,
    to: bounds.to,
    current: transactions.filter((t) => t.date >= bounds.from),
    previous: transactions.filter((t) => t.date < bounds.from),
    budgets,
    goals,
    monthName: bounds.name,
    previousMonthName: prevBounds.shortName,
  });
  const next = shiftMonth(month, 1);
  return { ...recap, firstMonth: earliest, nextMonth: next < currentMonth ? next : null };
}

// Last month's recap for the Home card during the first week of a month, or null. The first time it
// is ready, a notification goes to the bell as well, whether or not the card has been closed.
// `notified` says the notification was created just now, so the app can refresh the bell.
export async function latestRecap(userId: string, tzOffset: number, now = new Date()) {
  const none = { recap: null, notified: false };
  const local = localMonth(now, tzOffset);
  if (now.getTime() - local.from.getTime() >= CARD_DAYS * DAY) return none;
  const month = shiftMonth(local.key, -1);
  const bounds = monthBounds(month, tzOffset);
  const count = await prisma.transaction.count({ where: { userId, date: { gte: bounds.from, lt: bounds.to } } });
  if (count < MIN_TRANSACTIONS) return none;

  const announced = await prisma.notification.findFirst({ where: { userId, kind: "recap_ready", title: month } });
  if (!announced) await prisma.notification.create({ data: { userId, kind: "recap_ready", title: month } });
  const notified = !announced;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { recapDismissed: true } });
  if (user?.recapDismissed === month) return { recap: null, notified };
  const recap = await getRecap(userId, month, tzOffset, now);
  const summary = {
    month,
    monthName: recap.monthName,
    previousMonthName: recap.previousMonthName,
    totals: recap.totals,
    previous: recap.previous,
    wentWell: recap.wentWell,
  };
  return { recap: summary, notified };
}

export async function dismissRecap(userId: string, month: string) {
  await prisma.user.update({ where: { id: userId }, data: { recapDismissed: month } });
}

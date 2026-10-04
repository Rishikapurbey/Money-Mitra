import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { localMonth } from "../budgets/budgetAlert.service";
import { MIN_TRANSACTIONS, computeRecap } from "./recap";
import { MIN_YEAR_TRANSACTIONS, computeYearReview } from "./yearReview";
import { netWorthOver } from "../networth/networth.service";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// The recap card stays on Home for the first week of the month
const CARD_DAYS = 7;
// The year review card stays for the first two weeks of January
const YEAR_CARD_DAYS = 14;

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

  const [transactions, budgets, goals, contributions, earliest] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: prevBounds.from, lt: bounds.to } },
      select: { amount: true, type: true, category: true, note: true, date: true, recurringId: true },
    }),
    prisma.budget.findMany({ where: { userId }, select: { category: true, amount: true } }),
    prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, savedAmount: true, targetAmount: true },
    }),
    prisma.goalContribution.groupBy({
      by: ["goalId"],
      where: { userId, createdAt: { gte: bounds.from, lt: bounds.to } },
      _sum: { amount: true },
    }),
    firstMonth(userId, tzOffset),
  ]);
  const addedTo = new Map(contributions.map((c) => [c.goalId, c._sum.amount ?? 0]));

  const recap = computeRecap({
    month,
    from: bounds.from,
    to: bounds.to,
    current: transactions.filter((t) => t.date >= bounds.from),
    previous: transactions.filter((t) => t.date < bounds.from),
    budgets,
    goals: goals.map(({ id, ...g }) => ({ ...g, added: addedTo.get(id) ?? 0 })),
    monthName: bounds.name,
    previousMonthName: prevBounds.shortName,
  });
  const next = shiftMonth(month, 1);
  const netWorth = await netWorthOver(userId, bounds.from, bounds.to);
  return { ...recap, netWorth, firstMonth: earliest, nextMonth: next < currentMonth ? next : null };
}

// Records a "ready" notification once; true when it was created just now
async function announceOnce(userId: string, kind: "recap_ready" | "year_ready", title: string) {
  const announced = await prisma.notification.findFirst({ where: { userId, kind, title } });
  if (announced) return false;
  await prisma.notification.create({ data: { userId, kind, title } });
  return true;
}

// Last month's recap during the first week of a month
async function latestMonth(userId: string, tzOffset: number, now: Date, dismissed: string | null) {
  const local = localMonth(now, tzOffset);
  if (now.getTime() - local.from.getTime() >= CARD_DAYS * DAY) return { recap: null, notified: false };
  const month = shiftMonth(local.key, -1);
  const bounds = monthBounds(month, tzOffset);
  const count = await prisma.transaction.count({ where: { userId, date: { gte: bounds.from, lt: bounds.to } } });
  if (count < MIN_TRANSACTIONS) return { recap: null, notified: false };

  const notified = await announceOnce(userId, "recap_ready", month);
  if (dismissed === month) return { recap: null, notified };
  const recap = await getRecap(userId, month, tzOffset, now);
  return {
    recap: {
      month,
      monthName: recap.monthName,
      previousMonthName: recap.previousMonthName,
      totals: recap.totals,
      previous: recap.previous,
      wentWell: recap.wentWell,
    },
    notified,
  };
}

// Last year's review during the first two weeks of January
async function latestYear(userId: string, tzOffset: number, now: Date, dismissed: string | null) {
  const local = localMonth(now, tzOffset);
  if (!local.key.endsWith("-01") || now.getTime() - local.from.getTime() >= YEAR_CARD_DAYS * DAY) {
    return { year: null, notified: false };
  }
  const year = String(Number(local.key.slice(0, 4)) - 1);
  const count = await prisma.transaction.count({
    where: { userId, date: { gte: monthBounds(`${year}-01`, tzOffset).from, lt: local.from } },
  });
  if (count < MIN_YEAR_TRANSACTIONS) return { year: null, notified: false };

  const notified = await announceOnce(userId, "year_ready", year);
  if (dismissed === year) return { year: null, notified };
  const review = await getYearReview(userId, year, tzOffset, now);
  return { year: { year, totals: review.totals, highlights: review.highlights.slice(0, 2) }, notified };
}

// What the Home cards show: last month's recap in a month's first week, last year's review in
// January's first two weeks. The first time each is ready, a notification goes to the bell as well,
// whether or not the card has been closed. `notified` means one was created just now.
export async function latestRecap(userId: string, tzOffset: number, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { recapDismissed: true, yearReviewDismissed: true } });
  const month = await latestMonth(userId, tzOffset, now, user?.recapDismissed ?? null);
  const year = await latestYear(userId, tzOffset, now, user?.yearReviewDismissed ?? null);
  return { recap: month.recap, year: year.year, notified: month.notified || year.notified };
}

export async function dismissRecap(userId: string, month: string) {
  await prisma.user.update({ where: { id: userId }, data: { recapDismissed: month } });
}

export async function dismissYearReview(userId: string, year: string) {
  await prisma.user.update({ where: { id: userId }, data: { yearReviewDismissed: year } });
}

export const isYearKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}$/.test(value);

// A whole year, or the year so far while it's running
export async function getYearReview(userId: string, year: string, tzOffset: number, now = new Date()) {
  const currentMonth = localMonth(now, tzOffset).key;
  const currentYear = currentMonth.slice(0, 4);
  if (year > currentYear) throw new HttpError(400, "This year hasn't started yet");
  const inProgress = year === currentYear;
  const monthCount = inProgress ? Number(currentMonth.slice(5)) : 12;
  const months = Array.from({ length: monthCount }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const b = monthBounds(month, tzOffset);
    return { month, label: b.shortName.slice(0, 3), name: b.shortName, from: b.from, to: b.to };
  });
  const yearFrom = months[0]!.from;
  const yearTo = months[months.length - 1]!.to;
  const previousFrom = monthBounds(`${Number(year) - 1}-01`, tzOffset).from;

  const [transactions, budgets, goals, contributions, earliest] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: previousFrom, lt: yearTo } },
      select: { amount: true, type: true, category: true, note: true, date: true, recurringId: true },
    }),
    prisma.budget.findMany({ where: { userId }, select: { category: true, amount: true } }),
    prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, savedAmount: true, targetAmount: true },
    }),
    prisma.goalContribution.groupBy({
      by: ["goalId"],
      where: { userId, createdAt: { gte: yearFrom, lt: yearTo } },
      _sum: { amount: true },
    }),
    firstMonth(userId, tzOffset),
  ]);
  const addedTo = new Map(contributions.map((c) => [c.goalId, c._sum.amount ?? 0]));

  const review = computeYearReview({
    year,
    months,
    inProgress,
    now,
    current: transactions.filter((t) => t.date >= yearFrom),
    previous: transactions.filter((t) => t.date < yearFrom),
    budgets,
    goals: goals.map(({ id, ...g }) => ({ ...g, added: addedTo.get(id) ?? 0 })),
  });
  const firstYear = earliest ? earliest.slice(0, 4) : null;
  const nextYear = String(Number(year) + 1);
  const netWorth = await netWorthOver(userId, yearFrom, inProgress ? now : yearTo);
  return { ...review, netWorth, firstYear, nextYear: nextYear <= currentYear ? nextYear : null };
}

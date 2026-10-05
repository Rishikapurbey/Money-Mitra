import { Prisma } from "@prisma/client";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { rememberCategory } from "../categories/category.service";
import { daysUntil, dueOccurrences, firstDue, nextOccurrence, occurrenceIn, toLocalDate } from "./recurrence";
import type { Frequency } from "./recurrence";
import { checkBudget } from "../budgets/budgetAlert.service";

export type Mode = "auto" | "remind";

export interface RecurringInput {
  // Null only for a bill whose amount varies
  amount: number | null;
  type: string;
  category: string;
  note: string | null;
  mode: Mode;
  frequency: Frequency;
  dayOfMonth: number;
  // For yearly ones (0-11); taken from the start date when not given
  monthOfYear: number | null;
  endDate: Date | null;
}

async function findOwned(userId: string, id: string) {
  const rule = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!rule || rule.userId !== userId) throw new HttpError(404, "Recurring transaction not found");
  return rule;
}

export const listRecurring = (userId: string) =>
  prisma.recurringTransaction.findMany({ where: { userId }, orderBy: [{ paused: "asc" }, { nextDue: "asc" }] });

// Creates a rule. With `firstEntryId`, that transaction (already saved by the user) counts as the
// first entry: it gets linked to the rule and the next entry is due the following month.
export async function createRecurring(
  userId: string,
  data: RecurringInput & { tzOffset: number; from: Date; firstEntryId: string | null }
) {
  const { tzOffset, from, firstEntryId, ...fields } = data;
  if (fields.frequency === "yearly" && fields.monthOfYear === null) fields.monthOfYear = toLocalDate(from, tzOffset).month;
  let nextDue = firstDue(from, fields.dayOfMonth, tzOffset, fields.frequency, fields.monthOfYear);

  if (firstEntryId) {
    const entry = await prisma.transaction.findUnique({ where: { id: firstEntryId } });
    if (!entry || entry.userId !== userId) throw new HttpError(404, "Transaction not found");
    const { year, month } = toLocalDate(entry.date, tzOffset);
    if (fields.frequency === "yearly") fields.monthOfYear = month;
    nextDue = nextOccurrence(occurrenceIn(year, month, fields.dayOfMonth, tzOffset), fields.dayOfMonth, tzOffset, fields.frequency);
  }

  fields.category = await rememberCategory(userId, fields.type, fields.category);
  return prisma.$transaction(async (tx) => {
    const rule = await tx.recurringTransaction.create({ data: { ...fields, tzOffset, nextDue, userId } });
    if (firstEntryId) await tx.transaction.update({ where: { id: firstEntryId }, data: { recurringId: rule.id } });
    return rule;
  });
}

// Changing when it repeats moves the next entry to the first matching day from today
export async function updateRecurring(userId: string, id: string, data: RecurringInput) {
  const rule = await findOwned(userId, id);
  if (data.frequency === "yearly" && data.monthOfYear === null) data.monthOfYear = rule.monthOfYear ?? toLocalDate(rule.nextDue, rule.tzOffset).month;
  const sameSchedule =
    data.dayOfMonth === rule.dayOfMonth && data.frequency === rule.frequency && (data.frequency === "monthly" || data.monthOfYear === rule.monthOfYear);
  const nextDue = sameSchedule ? rule.nextDue : firstDue(new Date(), data.dayOfMonth, rule.tzOffset, data.frequency, data.monthOfYear);
  const category = await rememberCategory(userId, data.type, data.category);
  return prisma.recurringTransaction.update({ where: { id }, data: { ...data, category, nextDue } });
}

export async function setPaused(userId: string, id: string, paused: boolean) {
  const rule = await findOwned(userId, id);
  // Resuming continues from today; months that passed while paused are not filled in
  const nextDue = paused
    ? rule.nextDue
    : firstDue(new Date(), rule.dayOfMonth, rule.tzOffset, rule.frequency as Frequency, rule.monthOfYear);
  return prisma.recurringTransaction.update({ where: { id }, data: { paused, nextDue } });
}

// Stopping deletes the rule; entries already added stay, just unlinked
export async function stopRecurring(userId: string, id: string) {
  await findOwned(userId, id);
  await prisma.recurringTransaction.delete({ where: { id } });
}

// Adds every entry that has become due, exactly once. Each rule's nextDue acts as a lock: only the
// request that moves it forward adds the entries, so simultaneous catch-ups can't double-add.
export async function catchUp(userId: string, now = new Date()) {
  // Bills set to "remind me" are never added by themselves
  const rules = await prisma.recurringTransaction.findMany({
    where: { userId, paused: false, mode: "auto", nextDue: { lte: now } },
  });

  const added: { category: string; count: number }[] = [];
  for (const rule of rules) {
    const amount = rule.amount;
    if (amount === null) continue;
    const { due, nextDue } = dueOccurrences(rule.nextDue, now, rule.dayOfMonth, rule.tzOffset, rule.endDate, rule.frequency as Frequency);
    const created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.recurringTransaction.updateMany({
        where: { id: rule.id, nextDue: rule.nextDue },
        data: { nextDue },
      });
      if (claimed.count === 0 || due.length === 0) return 0;
      await tx.transaction.createMany({
        data: due.map((date) => ({
          userId,
          amount,
          type: rule.type,
          category: rule.category,
          note: rule.note,
          date,
          recurringId: rule.id,
        })),
      });
      return due.length;
    });
    if (created > 0) {
      added.push({ category: rule.category, count: created });
      const latest = due[due.length - 1];
      if (rule.type === "expense" && latest) await checkBudget(userId, rule.category, rule.tzOffset, latest, now);
    }
  }
  return added;
}

const billName = (rule: { note: string | null; category: string }) => rule.note?.trim() || rule.category;
const shortDate = (d: Date, tzOffset: number) =>
  new Date(d.getTime() - tzOffset * 60_000).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// Records a reminder as sent; false if it already was
async function claimReminder(recurringId: string, dueDate: Date, stage: "soon" | "today") {
  try {
    await prisma.billReminder.create({ data: { recurringId, dueDate, stage } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}

// Bell reminders for bills: two days before, and on the day (or as soon as the app opens after it).
// Each is sent once per due date. Returns how many were sent.
export async function remindBills(userId: string, now = new Date()) {
  const bills = await prisma.recurringTransaction.findMany({
    where: { userId, mode: "remind", paused: false, nextDue: { lte: new Date(now.getTime() + 3 * 24 * 60 * 60_000) } },
  });
  let sent = 0;
  for (const bill of bills) {
    if (bill.endDate && bill.nextDue > bill.endDate) continue;
    const days = daysUntil(bill.nextDue, now, bill.tzOffset);
    if (days > 2) continue;
    const stage = days > 0 ? "soon" : "today";
    if (!(await claimReminder(bill.id, bill.nextDue, stage))) continue;
    const amount = bill.amount !== null ? ` (₹${Math.round(bill.amount).toLocaleString("en-IN")})` : "";
    const title =
      days > 0
        ? `${billName(bill)}${amount} is due in ${days} day${days === 1 ? "" : "s"}`
        : days === 0
          ? `${billName(bill)}${amount} is due today`
          : `${billName(bill)}${amount} was due on ${shortDate(bill.nextDue, bill.tzOffset)}`;
    await prisma.notification.create({ data: { userId, kind: stage === "soon" ? "bill_soon" : "bill_today", title } });
    sent++;
  }
  return sent;
}

async function findBill(userId: string, id: string) {
  const rule = await findOwned(userId, id);
  if (rule.mode !== "remind") throw new HttpError(400, "This one is added automatically");
  return rule;
}

// Moves a bill on to its next due date. Only the request that moves it records anything, so
// pressing "Mark paid" twice can't pay the same bill twice.
async function settleBill(
  rule: { id: string; nextDue: Date; dayOfMonth: number; tzOffset: number; frequency: string },
  record: (tx: Prisma.TransactionClient) => Promise<unknown>
) {
  const nextDue = nextOccurrence(rule.nextDue, rule.dayOfMonth, rule.tzOffset, rule.frequency as Frequency);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.recurringTransaction.updateMany({ where: { id: rule.id, nextDue: rule.nextDue }, data: { nextDue } });
    if (claimed.count === 0) throw new HttpError(409, "This bill was already updated. Refresh to see it.");
    await record(tx);
    return tx.recurringTransaction.findUniqueOrThrow({ where: { id: rule.id } });
  });
}

// Records the payment as a transaction dated `paidOn` and moves the bill to its next due date
export async function payBill(userId: string, id: string, amount: number, paidOn: Date, tzOffset: number, now = new Date()) {
  const rule = await findBill(userId, id);
  const bill = await settleBill(rule, async (tx) => {
    const entry = await tx.transaction.create({
      data: { userId, amount, type: rule.type, category: rule.category, note: rule.note, date: paidOn, recurringId: rule.id },
    });
    await tx.billPayment.create({ data: { userId, recurringId: rule.id, dueDate: rule.nextDue, paidAt: entry.date } });
  });
  const budgetAlert = rule.type === "expense" ? await checkBudget(userId, rule.category, tzOffset, paidOn, now) : null;
  return { recurring: bill, budgetAlert };
}

// Nothing is recorded for this due date; the bill moves on to the next one
export async function skipBill(userId: string, id: string) {
  const rule = await findBill(userId, id);
  return settleBill(rule, (tx) => tx.billPayment.create({ data: { userId, recurringId: rule.id, dueDate: rule.nextDue, skipped: true } }));
}

// For the monthly recap: bills due in the month and how many were paid by their due date.
// A bill still unpaid after its date counts as not on time. Null when no bills were due.
export async function billsInMonth(userId: string, from: Date, to: Date, now = new Date()) {
  const [payments, unpaid] = await Promise.all([
    prisma.billPayment.findMany({
      where: { userId, skipped: false, dueDate: { gte: from, lt: to } },
      select: { dueDate: true, paidAt: true, recurring: { select: { tzOffset: true } } },
    }),
    prisma.recurringTransaction.count({
      where: { userId, mode: "remind", paused: false, nextDue: { gte: from, lt: to, lte: now } },
    }),
  ]);
  const onTime = payments.filter((p) => p.paidAt && daysUntil(p.dueDate, p.paidAt, p.recurring.tzOffset) >= 0).length;
  const total = payments.length + unpaid;
  return total > 0 ? { onTime, total } : null;
}


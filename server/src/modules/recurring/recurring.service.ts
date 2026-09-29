import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { rememberCategory } from "../categories/category.service";
import { dueOccurrences, firstOnOrAfter, nextAfter, occurrenceIn, toLocalDate } from "./recurrence";

export interface RecurringInput {
  amount: number;
  type: string;
  category: string;
  note: string | null;
  dayOfMonth: number;
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
  let nextDue = firstOnOrAfter(from, fields.dayOfMonth, tzOffset);

  if (firstEntryId) {
    const entry = await prisma.transaction.findUnique({ where: { id: firstEntryId } });
    if (!entry || entry.userId !== userId) throw new HttpError(404, "Transaction not found");
    const { year, month } = toLocalDate(entry.date, tzOffset);
    nextDue = nextAfter(occurrenceIn(year, month, fields.dayOfMonth, tzOffset), fields.dayOfMonth, tzOffset);
  }

  fields.category = await rememberCategory(userId, fields.type, fields.category);
  return prisma.$transaction(async (tx) => {
    const rule = await tx.recurringTransaction.create({ data: { ...fields, tzOffset, nextDue, userId } });
    if (firstEntryId) await tx.transaction.update({ where: { id: firstEntryId }, data: { recurringId: rule.id } });
    return rule;
  });
}

// Editing the day moves the next entry to the first matching day from today
export async function updateRecurring(userId: string, id: string, data: RecurringInput) {
  const rule = await findOwned(userId, id);
  const nextDue =
    data.dayOfMonth === rule.dayOfMonth ? rule.nextDue : firstOnOrAfter(new Date(), data.dayOfMonth, rule.tzOffset);
  const category = await rememberCategory(userId, data.type, data.category);
  return prisma.recurringTransaction.update({ where: { id }, data: { ...data, category, nextDue } });
}

export async function setPaused(userId: string, id: string, paused: boolean) {
  const rule = await findOwned(userId, id);
  // Resuming continues from today; months that passed while paused are not filled in
  const nextDue = paused ? rule.nextDue : firstOnOrAfter(new Date(), rule.dayOfMonth, rule.tzOffset);
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
  const rules = await prisma.recurringTransaction.findMany({
    where: { userId, paused: false, nextDue: { lte: now } },
  });

  const added: { category: string; count: number }[] = [];
  for (const rule of rules) {
    const { due, nextDue } = dueOccurrences(rule.nextDue, now, rule.dayOfMonth, rule.tzOffset, rule.endDate);
    const created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.recurringTransaction.updateMany({
        where: { id: rule.id, nextDue: rule.nextDue },
        data: { nextDue },
      });
      if (claimed.count === 0 || due.length === 0) return 0;
      await tx.transaction.createMany({
        data: due.map((date) => ({
          userId,
          amount: rule.amount,
          type: rule.type,
          category: rule.category,
          note: rule.note,
          date,
          recurringId: rule.id,
        })),
      });
      return due.length;
    });
    if (created > 0) added.push({ category: rule.category, count: created });
  }
  return added;
}

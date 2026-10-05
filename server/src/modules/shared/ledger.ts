import type { Prisma } from "@prisma/client";
import prisma from "../../db/prisma";
import { balances, toRupees } from "./split";

type Db = Prisma.TransactionClient | typeof prisma;

// "₹1,200" or "₹33.34", for activity lines
export const inr = (paise: number) => "₹" + toRupees(paise).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// Every member's balance in paise, including people who have left
export async function groupBalances(groupId: string, db: Db = prisma) {
  const [members, expenses, settlements] = await Promise.all([
    db.groupMember.findMany({ where: { groupId }, orderBy: { createdAt: "asc" }, select: { id: true } }),
    db.sharedExpense.findMany({ where: { groupId }, select: { paidById: true, amount: true, shares: { select: { memberId: true, amount: true } } } }),
    db.settlement.findMany({ where: { groupId }, select: { fromMemberId: true, toMemberId: true, amount: true } }),
  ]);
  return balances(
    members.map((m) => m.id),
    { expenses, settlements }
  );
}

// Whether a member appears in any expense or payback, and so can't simply be removed
export async function hasHistory(memberId: string) {
  const [paid, shares, settlements] = await Promise.all([
    prisma.sharedExpense.count({ where: { paidById: memberId } }),
    prisma.expenseShare.count({ where: { memberId } }),
    prisma.settlement.count({ where: { OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] } }),
  ]);
  return paid + shares + settlements > 0;
}

export const logActivity = (groupId: string, actorId: string | null, message: string, db: Db = prisma) =>
  db.groupActivity.create({ data: { groupId, actorId, message } });

// The user's own category spelled the way they spell it, so shares land in their existing category
async function trackerCategory(userId: string, category: string, db: Db) {
  const existing = await db.category.findFirst({ where: { userId, type: "expense", name: { equals: category, mode: "insensitive" } } });
  return existing?.name ?? category;
}

interface ExpenseForTracker {
  description: string;
  category: string;
  date: Date;
  shares: { id: string; amount: number; member: { userId: string | null } }[];
}

// Puts each Money Mitra member's share into their own Tracker as an expense, or brings an existing
// one up to date. The category is only overwritten when the group changed it, so a member's own
// recategorising sticks.
export async function syncTracker(db: Db, expense: ExpenseForTracker, groupName: string, categoryChanged: boolean) {
  const note = `${expense.description} (${groupName})`.slice(0, 200);
  for (const share of expense.shares) {
    const userId = share.member.userId;
    if (!userId) continue;
    const existing = await db.transaction.findUnique({ where: { shareId: share.id } });
    const fields = { amount: toRupees(share.amount), date: expense.date, note };
    if (existing) {
      await db.transaction.update({
        where: { id: existing.id },
        data: { ...fields, ...(categoryChanged && { category: await trackerCategory(userId, expense.category, db) }) },
      });
    } else {
      await db.transaction.create({
        data: { ...fields, userId, type: "expense", category: await trackerCategory(userId, expense.category, db), shareId: share.id },
      });
    }
  }
}

// Adds the Tracker entries a member is missing, e.g. after taking over a name-only spot
export async function backfillTracker(memberId: string) {
  const shares = await prisma.expenseShare.findMany({
    where: { memberId, transaction: null },
    include: { member: { select: { userId: true } }, expense: { include: { group: { select: { name: true } } } } },
  });
  for (const share of shares) {
    await syncTracker(prisma, { ...share.expense, shares: [share] }, share.expense.group.name, false);
  }
}

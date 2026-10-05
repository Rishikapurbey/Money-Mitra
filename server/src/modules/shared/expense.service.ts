import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { checkBudget } from "../budgets/budgetAlert.service";
import { notifyGroupMembers } from "../notifications/notification.service";
import { inr, logActivity, syncTracker } from "./ledger";
import { splitEqually } from "./split";
import { nameOf, writableMembership } from "./shared.service";

export type SplitInput = { type: "equal"; memberIds: string[] } | { type: "exact"; shares: { memberId: string; amount: number }[] };

export interface ExpenseInput {
  description: string;
  // In paise
  amount: number;
  category: string;
  // Left out to keep an edited expense's date; a new expense without one is dated now
  date: Date | undefined;
  paidById: string;
  split: SplitInput;
}

const memberInclude = { user: { select: { id: true, username: true, displayName: true, avatarUpdatedAt: true } } } as const;

// Checks the split against the group and works out each share. `allowed` is who may take part:
// current members, plus anyone already on the expense being edited.
function resolveShares(input: ExpenseInput, members: { id: string }[], allowed: Set<string>) {
  if (!allowed.has(input.paidById)) throw new HttpError(400, "Choose who paid from the group");
  const ordered = (ids: string[]) => members.map((m) => m.id).filter((id) => ids.includes(id));

  let shares: { memberId: string; amount: number }[];
  if (input.split.type === "equal") {
    const ids = [...new Set(input.split.memberIds)];
    if (ids.length === 0) throw new HttpError(400, "Choose who to split it between");
    if (ids.some((id) => !allowed.has(id))) throw new HttpError(400, "Choose people from the group");
    shares = splitEqually(input.amount, ordered(ids));
  } else {
    const ids = input.split.shares.map((s) => s.memberId);
    if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id))) throw new HttpError(400, "Choose people from the group");
    shares = input.split.shares;
    const total = shares.reduce((sum, s) => sum + s.amount, 0);
    if (total !== input.amount) throw new HttpError(400, `The shares add up to ${inr(total)}, not ${inr(input.amount)}`);
  }
  return shares.filter((s) => s.amount > 0);
}

// Expenses can push members' budgets past 80% or 100%. Their alerts go to their own bell;
// the person who added the expense also gets theirs back for a toast.
async function budgetAlerts(userIds: string[], category: string, date: Date, tzOffset: number, viewerId: string) {
  let mine = null;
  for (const userId of userIds) {
    try {
      const alert = await checkBudget(userId, category, tzOffset, date);
      if (userId === viewerId) mine = alert;
    } catch (err) {
      console.error("Budget check failed:", err);
    }
  }
  return mine;
}

// Tells the people an expense or payment affects. Notifications are secondary: a problem here
// must never undo the change itself.
async function tell(kind: "shared_activity" | "shared_payment", groupId: string, actorId: string, actor: string, groupName: string, messages: Map<string, string>) {
  try {
    await notifyGroupMembers(kind, groupId, actorId, messages, (count) =>
      kind === "shared_activity" ? `${actor} made ${count} changes to expenses in ${groupName}` : `${actor} made ${count} changes to payments in ${groupName}`
    );
  } catch (err) {
    console.error("Notification failed:", err);
  }
}

// Everyone on Money Mitra who paid for or has a share in an expense, each with their own line
function expenseMessages(
  members: { id: string; userId: string | null }[],
  payerIds: string[],
  shares: { memberId: string; amount: number }[],
  message: (share: number) => string
) {
  const messages = new Map<string, string>();
  for (const memberId of new Set([...payerIds, ...shares.map((s) => s.memberId)])) {
    const userId = members.find((m) => m.id === memberId)?.userId;
    if (userId) messages.set(userId, message(shares.find((s) => s.memberId === memberId)?.amount ?? 0));
  }
  return messages;
}

async function loadExpense(groupId: string, expenseId: string) {
  const expense = await prisma.sharedExpense.findFirst({
    where: { id: expenseId, groupId },
    include: { shares: { include: { member: { select: { userId: true } } } } },
  });
  if (!expense) throw new HttpError(404, "Expense not found");
  return expense;
}

export async function addExpense(userId: string, groupId: string, given: ExpenseInput, tzOffset: number) {
  const { group, actor } = await writableMembership(userId, groupId);
  const input = { ...given, date: given.date ?? new Date() };
  const members = await prisma.groupMember.findMany({ where: { groupId, status: "active" }, orderBy: { createdAt: "asc" }, include: memberInclude });
  const shares = resolveShares(input, members, new Set(members.map((m) => m.id)));

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.sharedExpense.create({
      data: {
        groupId,
        description: input.description,
        amount: input.amount,
        category: input.category,
        date: input.date,
        paidById: input.paidById,
        shares: { create: shares },
      },
      include: { shares: { include: { member: { select: { userId: true } } } } },
    });
    await syncTracker(tx, created, group.name, true);
    await logActivity(groupId, userId, `${actor} added ${input.description} (${inr(input.amount)})`, tx);
    return created;
  });

  await tell(
    "shared_activity",
    groupId,
    userId,
    actor,
    group.name,
    expenseMessages(members, [input.paidById], shares, (share) =>
      share > 0
        ? `${actor} added ${input.description} in ${group.name}. Your share is ${inr(share)}.`
        : `${actor} added ${input.description} (${inr(input.amount)}) in ${group.name}, paid by you.`
    )
  );
  const userIds = expense.shares.map((s) => s.member.userId).filter((id): id is string => id !== null);
  const budgetAlert = await budgetAlerts(userIds, input.category, input.date, tzOffset, userId);
  return { id: expense.id, budgetAlert };
}

// What changed, for the activity line: "amount ₹1,200 → ₹1,000, date"
function describeChanges(
  before: { description: string; amount: number; category: string; date: Date; paidById: string },
  after: ExpenseInput & { date: Date },
  splitChanged: boolean
) {
  const changes: string[] = [];
  if (before.description !== after.description) changes.push(`name to ${after.description}`);
  if (before.amount !== after.amount) changes.push(`amount ${inr(before.amount)} → ${inr(after.amount)}`);
  if (before.category !== after.category) changes.push(`category to ${after.category}`);
  if (before.date.getTime() !== after.date.getTime()) changes.push("date");
  if (before.paidById !== after.paidById) changes.push("who paid");
  if (splitChanged) changes.push("split");
  return changes;
}

export async function updateExpense(userId: string, groupId: string, expenseId: string, given: ExpenseInput, tzOffset: number) {
  const { group, actor } = await writableMembership(userId, groupId);
  const before = await loadExpense(groupId, expenseId);
  const input = { ...given, date: given.date ?? before.date };
  const members = await prisma.groupMember.findMany({ where: { groupId }, orderBy: { createdAt: "asc" }, include: memberInclude });
  const allowed = new Set([
    ...members.filter((m) => m.status === "active").map((m) => m.id),
    ...before.shares.map((s) => s.memberId),
    before.paidById,
  ]);
  const shares = resolveShares(input, members, allowed);

  const oldShares = new Map(before.shares.map((s) => [s.memberId, s]));
  const splitChanged =
    shares.length !== before.shares.length || shares.some((s) => oldShares.get(s.memberId)?.amount !== s.amount);
  const changes = describeChanges(before, input, splitChanged);
  if (changes.length === 0) return { id: expenseId, budgetAlert: null };

  const keep = new Set(shares.map((s) => s.memberId));
  const dropped = before.shares.filter((s) => !keep.has(s.memberId));

  const expense = await prisma.$transaction(async (tx) => {
    if (dropped.length > 0) {
      await tx.transaction.deleteMany({ where: { shareId: { in: dropped.map((s) => s.id) } } });
      await tx.expenseShare.deleteMany({ where: { id: { in: dropped.map((s) => s.id) } } });
    }
    for (const s of shares) {
      const old = oldShares.get(s.memberId);
      if (old) {
        if (old.amount !== s.amount) await tx.expenseShare.update({ where: { id: old.id }, data: { amount: s.amount } });
      } else {
        await tx.expenseShare.create({ data: { expenseId, memberId: s.memberId, amount: s.amount } });
      }
    }
    const updated = await tx.sharedExpense.update({
      where: { id: expenseId },
      data: { description: input.description, amount: input.amount, category: input.category, date: input.date, paidById: input.paidById },
      include: { shares: { include: { member: { select: { userId: true } } } } },
    });
    await syncTracker(tx, updated, group.name, before.category !== input.category);
    await logActivity(groupId, userId, `${actor} changed ${before.description}: ${changes.join(", ")}`, tx);
    return updated;
  });

  await tell(
    "shared_activity",
    groupId,
    userId,
    actor,
    group.name,
    expenseMessages(members, [before.paidById, input.paidById], [...shares, ...before.shares.map((s) => ({ ...s, amount: 0 }))], (share) =>
      `${actor} changed ${before.description} in ${group.name}: ${changes.join(", ")}.${share > 0 ? ` Your share is now ${inr(share)}.` : ""}`
    )
  );
  const userIds = expense.shares.map((s) => s.member.userId).filter((id): id is string => id !== null);
  const budgetAlert = await budgetAlerts(userIds, input.category, input.date, tzOffset, userId);
  return { id: expenseId, budgetAlert };
}

export async function deleteExpense(userId: string, groupId: string, expenseId: string) {
  const { actor, group } = await writableMembership(userId, groupId);
  const expense = await loadExpense(groupId, expenseId);
  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { id: true, userId: true } });
  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { shareId: { in: expense.shares.map((s) => s.id) } } });
    await tx.sharedExpense.delete({ where: { id: expenseId } });
    await logActivity(groupId, userId, `${actor} deleted ${expense.description} (${inr(expense.amount)})`, tx);
  });
  await tell(
    "shared_activity",
    groupId,
    userId,
    actor,
    group.name,
    expenseMessages(members, [expense.paidById], expense.shares, () => `${actor} deleted ${expense.description} (${inr(expense.amount)}) in ${group.name}`)
  );
}

export async function addSettlement(
  userId: string,
  groupId: string,
  input: { fromMemberId: string; toMemberId: string; amount: number; date: Date }
) {
  const { actor, group } = await writableMembership(userId, groupId);
  if (input.fromMemberId === input.toMemberId) throw new HttpError(400, "Choose two different people");
  const members = await prisma.groupMember.findMany({
    where: { groupId, status: "active", id: { in: [input.fromMemberId, input.toMemberId] } },
    include: memberInclude,
  });
  const from = members.find((m) => m.id === input.fromMemberId);
  const to = members.find((m) => m.id === input.toMemberId);
  if (!from || !to) throw new HttpError(400, "Choose people from the group");

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({ data: { groupId, ...input } });
    await logActivity(groupId, userId, `${actor} recorded that ${nameOf(from)} paid ${nameOf(to)} ${inr(input.amount)}`, tx);
    return created;
  });
  const messages = new Map<string, string>();
  if (to.userId) messages.set(to.userId, `${actor} recorded that ${nameOf(from)} paid you ${inr(input.amount)} in ${group.name}`);
  if (from.userId) messages.set(from.userId, `${actor} recorded that you paid ${nameOf(to)} ${inr(input.amount)} in ${group.name}`);
  await tell("shared_payment", groupId, userId, actor, group.name, messages);
  return { id: settlement.id };
}

export async function deleteSettlement(userId: string, groupId: string, settlementId: string) {
  const { actor, group } = await writableMembership(userId, groupId);
  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, groupId },
    include: { from: { include: memberInclude }, to: { include: memberInclude } },
  });
  if (!settlement) throw new HttpError(404, "Payment not found");
  await prisma.$transaction([
    prisma.settlement.delete({ where: { id: settlementId } }),
    prisma.groupActivity.create({
      data: { groupId, actorId: userId, message: `${actor} removed the payment of ${inr(settlement.amount)} from ${nameOf(settlement.from)} to ${nameOf(settlement.to)}` },
    }),
  ]);
  const message = `${actor} removed the payment of ${inr(settlement.amount)} from ${nameOf(settlement.from)} to ${nameOf(settlement.to)} in ${group.name}`;
  const messages = new Map<string, string>();
  for (const id of [settlement.from.userId, settlement.to.userId]) if (id) messages.set(id, message);
  await tell("shared_payment", groupId, userId, actor, group.name, messages);
}

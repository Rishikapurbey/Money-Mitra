import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";

export interface GoalInput {
  name: string;
  targetAmount: number;
  targetDate: Date | null;
}

async function findOwned(userId: string, id: string) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) throw new HttpError(404, "Goal not found");
  return goal;
}

export async function listGoals(userId: string) {
  return prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function createGoal(userId: string, data: GoalInput) {
  return prisma.goal.create({ data: { ...data, userId } });
}

export async function updateGoal(userId: string, id: string, data: GoalInput) {
  await findOwned(userId, id);
  return prisma.goal.update({ where: { id }, data });
}

// Adds (or, with a negative amount, withdraws) money, never going below zero. The change actually
// made is recorded, so a withdrawal larger than the balance is logged as what was really taken out.
export async function addToGoal(userId: string, id: string, amount: number) {
  const goal = await findOwned(userId, id);
  const savedAmount = Math.max(0, goal.savedAmount + amount);
  const applied = savedAmount - goal.savedAmount;
  if (applied === 0) return goal;
  const [updated] = await prisma.$transaction([
    prisma.goal.update({ where: { id }, data: { savedAmount } }),
    prisma.goalContribution.create({ data: { goalId: id, userId, amount: applied } }),
  ]);
  return updated;
}

const HISTORY_LIMIT = 20;

// The latest changes to a goal, and how much it held before changes were recorded
export async function goalHistory(userId: string, id: string) {
  const goal = await findOwned(userId, id);
  const [entries, total, count] = await Promise.all([
    prisma.goalContribution.findMany({
      where: { goalId: id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { id: true, amount: true, createdAt: true },
    }),
    prisma.goalContribution.aggregate({ where: { goalId: id }, _sum: { amount: true } }),
    prisma.goalContribution.count({ where: { goalId: id } }),
  ]);
  const beforeHistory = Math.round((goal.savedAmount - (total._sum.amount ?? 0)) * 100) / 100;
  return { entries, more: count > entries.length, beforeHistory: beforeHistory > 0 ? beforeHistory : 0 };
}

export async function deleteGoal(userId: string, id: string) {
  await findOwned(userId, id);
  await prisma.goal.delete({ where: { id } });
}

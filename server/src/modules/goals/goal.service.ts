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

// Adds (or, with a negative amount, withdraws) money, never going below zero
export async function addToGoal(userId: string, id: string, amount: number) {
  const goal = await findOwned(userId, id);
  const savedAmount = Math.max(0, goal.savedAmount + amount);
  return prisma.goal.update({ where: { id }, data: { savedAmount } });
}

export async function deleteGoal(userId: string, id: string) {
  await findOwned(userId, id);
  await prisma.goal.delete({ where: { id } });
}

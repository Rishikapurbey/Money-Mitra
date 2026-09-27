import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";

export async function listBudgets(userId: string) {
  return prisma.budget.findMany({ where: { userId }, orderBy: { category: "asc" } });
}

// One budget per category: setting it again updates the amount
export async function setBudget(userId: string, category: string, amount: number) {
  return prisma.budget.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, amount },
    update: { amount },
  });
}

export async function deleteBudget(userId: string, id: string) {
  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget || budget.userId !== userId) throw new HttpError(404, "Budget not found");
  await prisma.budget.delete({ where: { id } });
}

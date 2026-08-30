import prisma from "../../db/prisma";

export async function createTransaction(userId: string, amount: number, type: string, category: string, note?: string | null) {
  return prisma.transaction.create({
    data: { userId, amount, type, category, note: note ?? null },
  });
}

export async function getTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });
}

export async function getSummary(userId: string) {
  const transactions = await prisma.transaction.findMany({ where: { userId } });
  const income = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}
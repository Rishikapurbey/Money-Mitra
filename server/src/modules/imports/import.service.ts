import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { rememberCategory } from "../categories/category.service";
import { checkBudget } from "../budgets/budgetAlert.service";
import type { BudgetAlertResult } from "../budgets/budgetAlert.service";
import type { TransactionInput } from "../transactions/transaction.input";

export const MAX_IMPORT_ROWS = 2000;

export type ImportRow = TransactionInput & { date: Date };

// Saves every row of a file at once (all or nothing), tagged with the import so it can be undone
export async function importTransactions(userId: string, fileName: string, rows: ImportRow[]) {
  // New categories join the user's list once each; existing ones keep their spelling
  const spellings = new Map<string, string>();
  const keyOf = (row: ImportRow) => `${row.type}:${row.category.toLowerCase()}`;
  for (const row of rows) {
    if (!spellings.has(keyOf(row))) spellings.set(keyOf(row), await rememberCategory(userId, row.type, row.category));
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.import.create({ data: { userId, fileName, count: rows.length } });
    await tx.transaction.createMany({
      data: rows.map((row) => ({
        userId,
        importId: created.id,
        amount: row.amount,
        type: row.type,
        category: spellings.get(keyOf(row)) ?? row.category,
        note: row.note,
        date: row.date,
      })),
    });
    return created;
  });
}

// Imported spending this month can cross a budget. Alerts go to the bell but never by email, so
// importing a statement can't send a burst of emails. Returns the most serious one for a toast.
export async function checkImportedBudgets(userId: string, rows: ImportRow[], tzOffset: number) {
  const latestByCategory = new Map<string, Date>();
  for (const row of rows) {
    if (row.type !== "expense") continue;
    const key = row.category.toLowerCase();
    const latest = latestByCategory.get(key);
    if (!latest || row.date > latest) latestByCategory.set(key, row.date);
  }
  let worst: BudgetAlertResult | null = null;
  for (const [category, date] of latestByCategory) {
    const alert = await checkBudget(userId, category, tzOffset, date, new Date(), { email: false });
    if (alert && (!worst || alert.level > worst.level)) worst = alert;
  }
  return worst;
}

// The latest imports, with how many of their entries are still there
export async function listImports(userId: string) {
  const imports = await prisma.import.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { _count: { select: { transactions: true } } },
  });
  return imports.map(({ _count, userId: _, ...rest }) => ({ ...rest, remaining: _count.transactions }));
}

// Removes every entry an import added, including any edited since, and the import itself
export async function undoImport(userId: string, id: string) {
  const found = await prisma.import.findUnique({ where: { id } });
  if (!found || found.userId !== userId) throw new HttpError(404, "Import not found");
  const [deleted] = await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId, importId: id } }),
    prisma.import.delete({ where: { id } }),
  ]);
  return deleted.count;
}

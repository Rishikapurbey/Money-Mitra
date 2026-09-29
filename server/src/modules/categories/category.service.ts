import type { Prisma } from "@prisma/client";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";

export type CategoryType = "income" | "expense";

// Every new account starts with these (the add_categories migration gave them to existing accounts too)
export const STARTER_CATEGORIES: { name: string; type: CategoryType }[] = [
  { name: "Food", type: "expense" },
  { name: "Rent", type: "expense" },
  { name: "Transport", type: "expense" },
  { name: "Shopping", type: "expense" },
  { name: "Bills", type: "expense" },
  { name: "Health", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Salary", type: "income" },
  { name: "Freelance", type: "income" },
];

export async function addStarterCategories(userId: string) {
  await prisma.category.createMany({
    data: STARTER_CATEGORIES.map((c) => ({ ...c, userId })),
    skipDuplicates: true,
  });
}

// A category covers every capitalisation of its name ("food" entries belong to "Food")
const named = (name: string) => ({ equals: name, mode: "insensitive" as const });
const sameName = (userId: string, type: string, name: string) => ({ userId, type, name: named(name) });

// A category typed in while adding a transaction, budget or recurring rule joins the user's list.
// Returns the spelling to save: the existing category's, when it is already there in some capitalisation.
export async function rememberCategory(userId: string, type: string, name: string) {
  const existing = await prisma.category.findFirst({ where: sameName(userId, type, name) });
  if (existing) return existing.name;
  await prisma.category.createMany({ data: [{ userId, type, name }], skipDuplicates: true });
  return name;
}

// Moves budgets named `from` (any capitalisation) to `to`. There is one budget per name, so if `to`
// already has one it is kept and the others are removed.
async function moveBudgets(tx: Prisma.TransactionClient, userId: string, from: string, to: string) {
  const moving = await tx.budget.findMany({ where: { userId, category: named(from) }, orderBy: { createdAt: "asc" } });
  const target = await tx.budget.findFirst({
    where: { userId, category: named(to), NOT: { id: { in: moving.map((b) => b.id) } } },
  });
  const [keep, ...extra] = target ? [target, ...moving] : moving;
  if (extra.length > 0) await tx.budget.deleteMany({ where: { id: { in: extra.map((b) => b.id) } } });
  if (keep && keep.category !== to) await tx.budget.update({ where: { id: keep.id }, data: { category: to } });
}

async function findOwned(userId: string, id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category || category.userId !== userId) throw new HttpError(404, "Category not found");
  return category;
}

// The user's categories with how much uses each, so Settings can explain what a change affects.
// Any name in use that is missing from the list (e.g. saved while an older version was running) is added.
export async function listCategories(userId: string) {
  const [saved, transactionCounts, recurringCounts, budgets] = await Promise.all([
    prisma.category.findMany({ where: { userId } }),
    prisma.transaction.groupBy({ by: ["type", "category"], where: { userId }, _count: { _all: true } }),
    prisma.recurringTransaction.groupBy({ by: ["type", "category"], where: { userId }, _count: { _all: true } }),
    prisma.budget.findMany({ where: { userId }, select: { category: true } }),
  ]);
  const key = (type: string, name: string) => `${type}:${name.toLowerCase()}`;
  const count = (groups: typeof transactionCounts) => {
    const totals = new Map<string, number>();
    for (const g of groups) totals.set(key(g.type, g.category), (totals.get(key(g.type, g.category)) ?? 0) + g._count._all);
    return totals;
  };
  const transactions = count(transactionCounts);
  const recurring = count(recurringCounts);
  const budgeted = new Set(budgets.map((b) => key("expense", b.category)));

  const known = new Set(saved.map((c) => key(c.type, c.name)));
  const missing = new Map<string, { type: string; name: string }>();
  for (const { type, category } of [...transactionCounts, ...recurringCounts, ...budgets.map((b) => ({ type: "expense", category: b.category }))]) {
    if (!known.has(key(type, category))) missing.set(key(type, category), { type, name: category });
  }
  let categories = saved;
  if (missing.size > 0) {
    await prisma.category.createMany({ data: [...missing.values()].map((c) => ({ ...c, userId })), skipDuplicates: true });
    categories = await prisma.category.findMany({ where: { userId } });
  }

  return categories
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      transactions: transactions.get(key(c.type, c.name)) ?? 0,
      recurring: recurring.get(key(c.type, c.name)) ?? 0,
      hasBudget: c.type === "expense" && budgeted.has(key(c.type, c.name)),
    }));
}

export async function createCategory(userId: string, name: string, type: CategoryType) {
  if (await prisma.category.findFirst({ where: sameName(userId, type, name) })) {
    throw new HttpError(409, `You already have a category called ${name}`);
  }
  return prisma.category.create({ data: { userId, name, type } });
}

// Renames the category and every transaction, recurring rule and budget that uses it
export async function renameCategory(userId: string, id: string, name: string) {
  const category = await findOwned(userId, id);
  const clash = await prisma.category.findFirst({ where: { ...sameName(userId, category.type, name), NOT: { id } } });
  if (clash) throw new HttpError(409, `You already have a category called ${clash.name}. Merge them instead.`);
  if (name === category.name) return category;

  const { type, name: old } = category;
  return prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({ where: { userId, type, category: named(old) }, data: { category: name } });
    await tx.recurringTransaction.updateMany({ where: { userId, type, category: named(old) }, data: { category: name } });
    if (type === "expense") await moveBudgets(tx, userId, old, name);
    return tx.category.update({ where: { id }, data: { name } });
  });
}

// Moves everything from one category into another of the same type, then removes the first.
// If both had a budget, the one being merged into is kept.
export async function mergeCategory(userId: string, id: string, intoId: string) {
  if (id === intoId) throw new HttpError(400, "Choose a different category to merge into");
  const [from, into] = await Promise.all([findOwned(userId, id), findOwned(userId, intoId)]);
  if (from.type !== into.type) throw new HttpError(400, "Income and expense categories can't be merged");

  const { type } = from;
  return prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({ where: { userId, type, category: named(from.name) }, data: { category: into.name } });
    await tx.recurringTransaction.updateMany({
      where: { userId, type, category: named(from.name) },
      data: { category: into.name },
    });
    if (type === "expense") await moveBudgets(tx, userId, from.name, into.name);
    await tx.category.delete({ where: { id } });
    return into;
  });
}

// Only unused categories can be deleted, so no transaction is ever left with a category that
// isn't in the list; a used one should be merged into another instead
export async function deleteCategory(userId: string, id: string) {
  const category = await findOwned(userId, id);
  const { type, name } = category;
  const [transactions, recurring, budget] = await Promise.all([
    prisma.transaction.count({ where: { userId, type, category: named(name) } }),
    prisma.recurringTransaction.count({ where: { userId, type, category: named(name) } }),
    type === "expense" ? prisma.budget.count({ where: { userId, category: named(name) } }) : 0,
  ]);
  const uses = [
    transactions && `${transactions} transaction${transactions === 1 ? "" : "s"}`,
    recurring && `${recurring} recurring ${recurring === 1 ? "entry" : "entries"}`,
    budget && "a budget",
  ].filter(Boolean);
  if (uses.length > 0) {
    throw new HttpError(409, `${name} is used by ${uses.join(", ")}. Merge it into another category instead.`);
  }
  await prisma.category.delete({ where: { id } });
}

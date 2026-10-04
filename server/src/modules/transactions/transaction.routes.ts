import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { checkBudget } from "../budgets/budgetAlert.service";
import {
  createTransaction,
  getTransactions,
  getSummary,
  getTrend,
  deleteTransaction,
  updateTransaction,
  DateRange,
  getInsights,
  searchTransactions,
  getCategories,
  TransactionSearch,
} from "./transaction.service";
import { parseDate, parseTransaction, parseTzOffset } from "./transaction.input";

const router = Router();

function parseRange(query: Record<string, unknown>): DateRange | null {
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from === null || to === null) return null;
  return { from, to };
}

// Returns the validated search, or an error message
function parseSearch(query: Record<string, unknown>): TransactionSearch | string {
  const range = parseRange(query);
  if (!range) return "Invalid date range";
  const q = typeof query.q === "string" ? query.q.trim() : "";
  if (q.length > 100) return "Search can be up to 100 characters";
  const type = query.type;
  if (type !== undefined && type !== "income" && type !== "expense") return "Type must be income or expense";
  const category = typeof query.category === "string" ? query.category.trim() : "";
  if (category.length > 50) return "Category can be up to 50 characters";
  const amount = (value: unknown) => (value === undefined || value === "" ? undefined : Number(value));
  const min = amount(query.min);
  const max = amount(query.max);
  for (const n of [min, max]) {
    if (n !== undefined && (!Number.isFinite(n) || n < 0)) return "Amounts must be positive numbers";
  }
  if (min !== undefined && max !== undefined && min > max) return "Minimum amount can't be more than the maximum";
  return { range, q: q || undefined, type, category: category || undefined, min, max };
}

// Expenses can push a budget past 80% or 100%; the alert, if any, is returned for a toast
const budgetAlertFor = (userId: string, t: { type: string; category: string; date: Date }, tzOffset: unknown) =>
  t.type === "expense" ? checkBudget(userId, t.category, parseTzOffset(tzOffset), t.date) : Promise.resolve(null);

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseTransaction(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  const date = parseDate(req.body.date);
  if (date === null) return res.status(400).json({ error: "Invalid date" });
  const { amount, type, category, note } = input;
  const transaction = await createTransaction(req.userId, amount, type, category, note, date);
  const budgetAlert = await budgetAlertFor(req.userId, transaction, req.body.tzOffset);
  res.status(201).json({ transaction, budgetAlert });
});

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const range = parseRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const transactions = await getTransactions(req.userId, range);
  res.status(200).json({ transactions });
});

router.get("/search", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const search = parseSearch(req.query);
  if (typeof search === "string") return res.status(400).json({ error: search });
  const cursor = typeof req.query.cursor === "string" && req.query.cursor.length <= 50 ? req.query.cursor : undefined;
  res.status(200).json(await searchTransactions(req.userId, search, cursor));
});

router.get("/categories", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ categories: await getCategories(req.userId) });
});

router.get("/summary", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const range = parseRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const summary = await getSummary(req.userId, range);
  res.status(200).json({ summary });
});

router.get("/trend", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const from = parseDate(req.query.from);
  const tzOffset = Number(req.query.tzOffset ?? 0);
  if (!from || !Number.isFinite(tzOffset)) {
    return res.status(400).json({ error: "from and a numeric tzOffset are required" });
  }
  const trend = await getTrend(req.userId, from, tzOffset);
  res.status(200).json({ trend });
});

router.get("/insights", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const prevFrom = parseDate(req.query.prevFrom);
  const tzOffset = Number(req.query.tzOffset ?? 0);
  if (!from || !to || !prevFrom || !(prevFrom < from && from < to) || !Number.isFinite(tzOffset)) {
    return res.status(400).json({ error: "from, to and prevFrom (in order) and a numeric tzOffset are required" });
  }
  const insights = await getInsights(req.userId, from, to, prevFrom, tzOffset);
  res.status(200).json({ insights });
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id as string;
  await deleteTransaction(req.userId, id);
  res.status(200).json({ success: true });
});

router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id as string;
  const input = parseTransaction(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  const date = parseDate(req.body.date);
  if (date === null) return res.status(400).json({ error: "Invalid date" });
  const transaction = await updateTransaction(req.userId, id, { ...input, date });
  const budgetAlert = await budgetAlertFor(req.userId, transaction, req.body.tzOffset);
  res.status(200).json({ transaction, budgetAlert });
});

export default router;

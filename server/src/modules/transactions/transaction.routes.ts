import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import {
  createTransaction,
  getTransactions,
  getSummary,
  getTrend,
  deleteTransaction,
  updateTransaction,
  DateRange,
} from "./transaction.service";

const router = Router();

// Returns undefined when absent, null when present but not a valid date
function parseDate(value: unknown): Date | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
}

interface TransactionInput {
  amount: number;
  type: string;
  category: string;
  note: string | null;
}

// Returns the validated fields, or an error message
function parseTransaction(body: Record<string, unknown>): TransactionInput | string {
  const amount = Number(body.amount);
  const type = body.type;
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return "Amount must be a positive number";
  }
  if (type !== "income" && type !== "expense") return "Type must be income or expense";
  if (!category || category.length > 50) return "Category is required (up to 50 characters)";
  if (note.length > 200) return "Note can be up to 200 characters";
  return { amount, type, category, note: note || null };
}

function parseRange(query: Record<string, unknown>): DateRange | null {
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from === null || to === null) return null;
  return { from, to };
}

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseTransaction(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  const date = parseDate(req.body.date);
  if (date === null) return res.status(400).json({ error: "Invalid date" });
  const { amount, type, category, note } = input;
  const transaction = await createTransaction(req.userId, amount, type, category, note, date);
  res.status(201).json({ transaction });
});

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const range = parseRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const transactions = await getTransactions(req.userId, range);
  res.status(200).json({ transactions });
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
  res.status(200).json({ transaction });
});

export default router;

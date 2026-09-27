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

function parseRange(query: Record<string, unknown>): DateRange | null {
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from === null || to === null) return null;
  return { from, to };
}

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const { amount, type, category, note } = req.body;
  if (!amount || !type || !category) {
    return res.status(400).json({ error: "amount, type, and category are required" });
  }
  const date = parseDate(req.body.date);
  if (date === null) return res.status(400).json({ error: "Invalid date" });
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
  try {
    await deleteTransaction(req.userId, id);
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id as string;
  const date = parseDate(req.body.date);
  if (date === null) return res.status(400).json({ error: "Invalid date" });
  try {
    const { amount, type, category, note } = req.body;
    const transaction = await updateTransaction(req.userId, id, {
      amount, type, category, note: note ?? null, date,
    });
    res.status(200).json({ transaction });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;

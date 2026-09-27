import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { text } from "../../lib/validation";
import {
  RecurringInput,
  catchUp,
  createRecurring,
  listRecurring,
  setPaused,
  stopRecurring,
  updateRecurring,
} from "./recurring.service";

const router = Router();

// Returns the validated fields, or an error message
function parseRecurring(body: Record<string, unknown>): RecurringInput | string {
  const amount = Number(body.amount);
  const type = body.type;
  const category = text(body.category);
  const note = text(body.note);
  const dayOfMonth = Number(body.dayOfMonth);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return "Amount must be a positive number";
  if (type !== "income" && type !== "expense") return "Type must be income or expense";
  if (!category || category.length > 50) return "Category is required (up to 50 characters)";
  if (note.length > 200) return "Note can be up to 200 characters";
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return "Day of the month must be between 1 and 31";
  let endDate: Date | null = null;
  if (body.endDate) {
    endDate = new Date(String(body.endDate));
    if (isNaN(endDate.getTime())) return "Invalid end date";
  }
  return { amount, type, category, note: note || null, dayOfMonth, endDate };
}

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ recurring: await listRecurring(req.userId) });
});

// Called when the app opens: adds any entries that became due since the last visit
router.post("/run", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ added: await catchUp(req.userId) });
});

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseRecurring(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  const tzOffset = Number(req.body.tzOffset ?? 0);
  const from = req.body.from ? new Date(String(req.body.from)) : new Date();
  if (!Number.isFinite(tzOffset) || Math.abs(tzOffset) > 14 * 60 || isNaN(from.getTime())) {
    return res.status(400).json({ error: "Invalid timezone or start date" });
  }
  const firstEntryId = typeof req.body.firstEntryId === "string" ? req.body.firstEntryId : null;
  const recurring = await createRecurring(req.userId, { ...input, tzOffset, from, firstEntryId });
  res.status(201).json({ recurring });
});

router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseRecurring(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  res.status(200).json({ recurring: await updateRecurring(req.userId, req.params.id as string, input) });
});

router.post("/:id/pause", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ recurring: await setPaused(req.userId, req.params.id as string, true) });
});

router.post("/:id/resume", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ recurring: await setPaused(req.userId, req.params.id as string, false) });
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await stopRecurring(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

export default router;

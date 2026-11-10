import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { parseDate } from "../transactions/transaction.input";
import { createTransfer, deleteTransfer, listTransfers, updateTransfer } from "./transfer.service";
import type { TransferInput } from "./transfer.service";

const router = Router();

// Returns the validated transfer, or an error message
function parseTransfer(body: Record<string, unknown>): TransferInput | string {
  const id = (value: unknown) => (typeof value === "string" && value.length > 0 && value.length <= 50 ? value : null);
  const fromId = id(body.fromId);
  const toId = id(body.toId);
  const amount = Number(body.amount);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!fromId || !toId) return "Choose where the money comes from and where it goes";
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return "Amount must be a positive number";
  if (note.length > 200) return "Note can be up to 200 characters";
  const date = parseDate(body.date);
  if (date === null) return "Invalid date";
  return { fromId, toId, amount: Math.round(amount * 100) / 100, date, note: note || null };
}

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (from === null || to === null) return res.status(400).json({ error: "Invalid date range" });
  const account = typeof req.query.account === "string" && req.query.account.length <= 50 ? req.query.account : undefined;
  res.status(200).json({ transfers: await listTransfers(req.userId, { from, to }, account) });
});

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseTransfer(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  res.status(201).json(await createTransfer(req.userId, input));
});

router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseTransfer(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  res.status(200).json(await updateTransfer(req.userId, req.params.id as string, input));
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deleteTransfer(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

export default router;

import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { createTransaction, getTransactions, getSummary } from "./transaction.service";

const router = Router();

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const { amount, type, category, note } = req.body;
  if (!amount || !type || !category) {
    return res.status(400).json({ error: "amount, type, and category are required" });
  }
  const transaction = await createTransaction(req.userId, amount, type, category, note);
  res.status(201).json({ transaction });
});

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const transactions = await getTransactions(req.userId);
  res.status(200).json({ transactions });
});

router.get("/summary", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const summary = await getSummary(req.userId);
  res.status(200).json({ summary });
});

export default router;
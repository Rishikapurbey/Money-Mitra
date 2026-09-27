import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { listBudgets, setBudget, deleteBudget } from "./budget.service";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const budgets = await listBudgets(req.userId);
  res.status(200).json({ budgets });
});

router.put("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
  const amount = Number(req.body.amount);
  if (!category || category.length > 50) {
    return res.status(400).json({ error: "Category is required (up to 50 characters)" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Budget amount must be greater than zero" });
  }
  const budget = await setBudget(req.userId, category, amount);
  res.status(200).json({ budget });
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deleteBudget(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

export default router;

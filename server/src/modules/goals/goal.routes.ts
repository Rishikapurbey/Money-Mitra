import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { listGoals, createGoal, updateGoal, addToGoal, deleteGoal, GoalInput } from "./goal.service";

const router = Router();

// Returns the validated goal, or an error message
function parseGoal(body: Record<string, unknown>): GoalInput | string {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const targetAmount = Number(body.targetAmount);
  if (!name || name.length > 60) return "Goal name is required (up to 60 characters)";
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return "Target amount must be greater than zero";
  let targetDate: Date | null = null;
  if (body.targetDate) {
    targetDate = new Date(String(body.targetDate));
    if (isNaN(targetDate.getTime())) return "Invalid target date";
  }
  return { name, targetAmount, targetDate };
}

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const goals = await listGoals(req.userId);
  res.status(200).json({ goals });
});

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseGoal(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  const goal = await createGoal(req.userId, input);
  res.status(201).json({ goal });
});

router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseGoal(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  const goal = await updateGoal(req.userId, req.params.id as string, input);
  res.status(200).json({ goal });
});

router.post("/:id/contributions", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: "Enter an amount to add or withdraw" });
  }
  const goal = await addToGoal(req.userId, req.params.id as string, amount);
  res.status(200).json({ goal });
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deleteGoal(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

export default router;

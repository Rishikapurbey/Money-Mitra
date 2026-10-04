import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { parseTzOffset } from "../transactions/transaction.input";
import { dismissRecap, getRecap, isMonthKey, latestRecap } from "./recap.service";

const router = Router();

// Last month's recap for the Home card, or null outside the first week or without enough entries
router.get("/latest", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await latestRecap(req.userId, parseTzOffset(req.query.tzOffset)));
});

router.get("/:month", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!isMonthKey(req.params.month)) return res.status(400).json({ error: "Month must look like 2026-09" });
  res.status(200).json({ recap: await getRecap(req.userId, req.params.month, parseTzOffset(req.query.tzOffset)) });
});

// Hides the Home card for that month
router.post("/:month/dismiss", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!isMonthKey(req.params.month)) return res.status(400).json({ error: "Month must look like 2026-09" });
  await dismissRecap(req.userId, req.params.month);
  res.status(200).json({ success: true });
});

export default router;

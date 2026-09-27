import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { accountLimiter } from "../../middleware/rateLimit";
import { passwordProblem, text, usernameProblem } from "../../lib/validation";
import { changePassword, changeUsername, deleteAccount, exportData } from "./account.service";

const router = Router();

const password = (value: unknown) => (typeof value === "string" ? value : "");

router.put("/password", authMiddleware, accountLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const current = password(req.body.currentPassword);
  const next = password(req.body.newPassword);
  if (!current) return res.status(400).json({ error: "Enter your current password" });
  const problem = passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem });
  if (current === next) return res.status(400).json({ error: "Your new password must be different" });
  await changePassword(req.userId, current, next);
  res.status(200).json({ success: true });
});

router.put("/username", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const username = text(req.body.username);
  const problem = usernameProblem(username);
  if (problem) return res.status(400).json({ error: problem });
  const user = await changeUsername(req.userId, username);
  res.status(200).json({ user });
});

router.get("/export", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const data = await exportData(req.userId);
  res.status(200).json({ data });
});

router.delete("/", authMiddleware, accountLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const current = password(req.body.password);
  if (!current) return res.status(400).json({ error: "Enter your password to confirm" });
  await deleteAccount(req.userId, current);
  res.status(200).json({ success: true });
});

export default router;

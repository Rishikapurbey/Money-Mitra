import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { followLimiter } from "../../middleware/rateLimit";
import { acceptRequest, declineRequest, follow, listRequests, removeFollower, unfollow } from "./follow.service";

const router = Router();

// Follow requests waiting for your answer
router.get("/requests", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ requests: await listRequests(req.userId) });
});

router.post("/requests/:username/accept", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await acceptRequest(req.userId, req.params.username as string);
  res.status(200).json({ success: true });
});

router.delete("/requests/:username", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await declineRequest(req.userId, req.params.username as string);
  res.status(200).json({ success: true });
});

router.delete("/followers/:username", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await removeFollower(req.userId, req.params.username as string);
  res.status(200).json({ success: true });
});

router.post("/:username", authMiddleware, followLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ followStatus: await follow(req.userId, req.params.username as string) });
});

router.delete("/:username", authMiddleware, followLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ followStatus: await unfollow(req.userId, req.params.username as string) });
});

export default router;

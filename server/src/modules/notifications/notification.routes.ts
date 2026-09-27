import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { listNotifications, markAllRead, markPostRead, markRead, unreadCount } from "./notification.service";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await listNotifications(req.userId));
});

router.get("/unread-count", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ unread: await unreadCount(req.userId) });
});

router.post("/read-all", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await markAllRead(req.userId);
  res.status(200).json({ success: true });
});

router.post("/posts/:postId/read", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await markPostRead(req.userId, req.params.postId as string);
  res.status(200).json({ success: true });
});

router.post("/:id/read", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await markRead(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

export default router;

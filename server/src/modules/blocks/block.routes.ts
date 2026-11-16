import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { followLimiter } from "../../middleware/rateLimit";
import { block, listBlocked, unblock } from "./block.service";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ blocked: await listBlocked(req.userId) });
});

router.post("/:username", authMiddleware, followLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await block(req.userId, req.params.username as string);
  res.status(200).json({ blocked: true });
});

router.delete("/:username", authMiddleware, followLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await unblock(req.userId, req.params.username as string);
  res.status(200).json({ blocked: false });
});

export default router;

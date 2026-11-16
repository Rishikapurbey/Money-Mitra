import { Router } from "express";
import type { NextFunction, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { adminOverview, isAdmin } from "./admin.service";

const router = Router();

// Anyone else gets the same "Not found" as an unknown address, so the page's existence isn't revealed
async function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId || !(await isAdmin(req.userId))) return res.status(404).json({ error: "Not found" });
  next();
}

router.get("/", authMiddleware, adminOnly, async (req, res) => {
  res.status(200).json(await adminOverview());
});

export default router;

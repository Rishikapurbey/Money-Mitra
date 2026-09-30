import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { getAvatar, getProfile } from "./profile.service";

const router = Router();

router.get("/:username", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfile(req.userId, req.params.username as string);
  res.status(200).json({ profile });
});

// Photos load in <img> tags, which can't send the login token, so this is public, like a
// profile picture anywhere else. The address includes a version, so it can be cached for good.
router.get("/:username/avatar", async (req, res) => {
  const avatar = await getAvatar(req.params.username as string);
  if (!avatar) return res.status(404).json({ error: "No photo" });
  res
    .set({
      "Content-Type": avatar.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      // The website and the API are on different domains; without this the browser refuses the image
      "Cross-Origin-Resource-Policy": "cross-origin",
    })
    .send(avatar.data);
});

export default router;

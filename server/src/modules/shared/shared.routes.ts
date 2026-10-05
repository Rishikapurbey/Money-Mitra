import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { sharedLimiter } from "../../middleware/rateLimit";
import { text } from "../../lib/validation";
import {
  acceptInvite,
  addNameOnly,
  createGroup,
  declineInvite,
  getGroup,
  inviteUser,
  joinByLink,
  joinPreview,
  leaveGroup,
  listGroups,
  removeMember,
  renameGroup,
  setArchived,
  shareLink,
} from "./shared.service";

const router = Router();

const groupName = (raw: unknown) => {
  const name = text(raw);
  return name && name.length <= 40 ? name : null;
};
const GROUP_NAME_ERROR = "Group name is required (up to 40 characters)";

router.get("/groups", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await listGroups(req.userId));
});

router.post("/groups", authMiddleware, sharedLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const name = groupName(req.body.name);
  if (!name) return res.status(400).json({ error: GROUP_NAME_ERROR });
  res.status(201).json({ group: await createGroup(req.userId, name) });
});

router.get("/groups/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ group: await getGroup(req.userId, req.params.id as string) });
});

router.put("/groups/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const name = groupName(req.body.name);
  if (!name) return res.status(400).json({ error: GROUP_NAME_ERROR });
  await renameGroup(req.userId, req.params.id as string, name);
  res.status(200).json({ success: true });
});

router.put("/groups/:id/archive", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  if (typeof req.body.archived !== "boolean") return res.status(400).json({ error: "Invalid request" });
  await setArchived(req.userId, req.params.id as string, req.body.archived);
  res.status(200).json({ success: true });
});

// Either { username } to invite someone on Money Mitra, or { name } for a friend who isn't
router.post("/groups/:id/members", authMiddleware, sharedLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = req.params.id as string;
  const username = text(req.body.username).replace(/^@/, "");
  if (username) return res.status(201).json({ member: await inviteUser(req.userId, groupId, username) });
  const name = text(req.body.name);
  if (!name || name.length > 40) return res.status(400).json({ error: "Enter a username, or a name (up to 40 characters)" });
  res.status(201).json({ member: await addNameOnly(req.userId, groupId, name) });
});

router.delete("/groups/:id/members/:memberId", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await removeMember(req.userId, req.params.id as string, req.params.memberId as string);
  res.status(200).json({ success: true });
});

router.post("/groups/:id/members/:memberId/link", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ token: await shareLink(req.userId, req.params.id as string, req.params.memberId as string) });
});

router.post("/groups/:id/leave", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await leaveGroup(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

router.post("/invites/:id/accept", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await acceptInvite(req.userId, req.params.id as string));
});

router.delete("/invites/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await declineInvite(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

router.get("/join/:token", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await joinPreview(req.userId, req.params.token as string));
});

router.post("/join/:token", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await joinByLink(req.userId, req.params.token as string));
});

export default router;

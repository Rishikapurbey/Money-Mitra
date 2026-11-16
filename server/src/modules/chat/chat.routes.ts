import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { chatStartLimiter, messageLimiter } from "../../middleware/rateLimit";
import { text } from "../../lib/validation";
import {
  acceptRequest,
  deleteForMe,
  getConversation,
  listConversations,
  sendMessage,
  startConversation,
  unreadCounts,
  unsendMessage,
} from "./chat.service";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const tab = req.query.tab === "requests" ? "requests" : "chats";
  res.status(200).json({ conversations: await listConversations(req.userId, tab) });
});

router.get("/unread", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await unreadCounts(req.userId));
});

// Opens the chat with someone, from the Message button on their profile
router.post("/", authMiddleware, chatStartLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const username = text(req.body?.username);
  if (!username) return res.status(400).json({ error: "Who do you want to message?" });
  res.status(200).json({ id: await startConversation(req.userId, username) });
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const before = typeof req.query.before === "string" ? new Date(req.query.before) : undefined;
  if (before && Number.isNaN(before.getTime())) return res.status(400).json({ error: "Invalid date" });
  res.status(200).json(await getConversation(req.userId, req.params.id as string, before));
});

router.post("/:id/messages", authMiddleware, messageLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const body = typeof req.body?.body === "string" ? req.body.body : "";
  res.status(201).json({ message: await sendMessage(req.userId, req.params.id as string, body) });
});

router.delete("/:id/messages/:messageId", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ message: await unsendMessage(req.userId, req.params.id as string, req.params.messageId as string) });
});

router.post("/:id/accept", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await acceptRequest(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deleteForMe(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

export default router;

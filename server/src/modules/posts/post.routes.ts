import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { postLimiter, reportLimiter } from "../../middleware/rateLimit";
import {
  REPORT_REASONS,
  TOPICS,
  acceptAnswer,
  createPost,
  createReply,
  deletePost,
  deleteReply,
  getActivity,
  getPost,
  listPosts,
  report,
  toggleHelpful,
} from "./post.service";
import { requireVerifiedEmail } from "../auth/emailVerification.service";

const router = Router();

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const topic = text(req.query.topic);
  if (topic && !TOPICS.includes(topic)) return res.status(400).json({ error: "Unknown topic" });
  const q = text(req.query.q);
  if (q.length > 100) return res.status(400).json({ error: "Search can be up to 100 characters" });
  const posts = await listPosts(req.userId, {
    topic: topic || undefined,
    unanswered: req.query.unanswered === "1",
    following: req.query.following === "1",
    q: q || undefined,
  });
  res.status(200).json({ posts });
});

// The viewer's own questions and replies; before /:id so "activity" isn't read as a post id
router.get("/activity", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await getActivity(req.userId));
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const post = await getPost(req.userId, req.params.id as string);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.status(200).json({ post });
});

router.post("/", authMiddleware, postLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await requireVerifiedEmail(req.userId);
  const title = text(req.body.title);
  const body = text(req.body.body);
  const topic = text(req.body.topic);
  if (title.length < 5 || title.length > 150) {
    return res.status(400).json({ error: "Title must be between 5 and 150 characters" });
  }
  if (body.length > 5000) {
    return res.status(400).json({ error: "Details can be up to 5000 characters" });
  }
  if (!TOPICS.includes(topic)) return res.status(400).json({ error: "Please choose a topic" });
  const post = await createPost(req.userId, { title, body, topic, isAnonymous: req.body.isAnonymous === true });
  res.status(201).json({ post });
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deletePost(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

router.post("/:id/replies", authMiddleware, postLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await requireVerifiedEmail(req.userId);
  const body = text(req.body.body);
  if (!body || body.length > 3000) {
    return res.status(400).json({ error: "Reply must be between 1 and 3000 characters" });
  }
  const reply = await createReply(req.userId, req.params.id as string, {
    body,
    isAnonymous: req.body.isAnonymous === true,
  });
  res.status(201).json({ reply });
});

router.delete("/:id/replies/:replyId", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deleteReply(req.userId, req.params.id as string, req.params.replyId as string);
  res.status(200).json({ success: true });
});

router.post("/:id/replies/:replyId/helpful", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const result = await toggleHelpful(req.userId, req.params.id as string, req.params.replyId as string);
  res.status(200).json(result);
});

const reasonKey = (value: unknown) => {
  const key = text(value);
  return key in REPORT_REASONS ? key : null;
};

// The asker picks the reply that answered the question, or clears it with { replyId: null }
router.put("/:id/accepted", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const replyId = req.body.replyId;
  if (replyId !== null && typeof replyId !== "string") return res.status(400).json({ error: "Choose a reply" });
  res.status(200).json(await acceptAnswer(req.userId, req.params.id as string, replyId));
});

router.post("/:id/report", authMiddleware, reportLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const reason = reasonKey(req.body.reason);
  if (!reason) return res.status(400).json({ error: "Please choose a reason" });
  const result = await report(req.userId, req.params.id as string, null, reason);
  res.status(201).json(result);
});

router.post("/:id/replies/:replyId/report", authMiddleware, reportLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const reason = reasonKey(req.body.reason);
  if (!reason) return res.status(400).json({ error: "Please choose a reason" });
  const result = await report(req.userId, req.params.id as string, req.params.replyId as string, reason);
  res.status(201).json(result);
});

export default router;

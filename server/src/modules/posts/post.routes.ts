import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { postLimiter } from "../../middleware/rateLimit";
import { TOPICS, listPosts, getPost, createPost, deletePost, createReply, deleteReply } from "./post.service";

const router = Router();

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const topic = text(req.query.topic);
  if (topic && !TOPICS.includes(topic)) return res.status(400).json({ error: "Unknown topic" });
  const posts = await listPosts(req.userId, topic || undefined);
  res.status(200).json({ posts });
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const post = await getPost(req.userId, req.params.id as string);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.status(200).json({ post });
});

router.post("/", authMiddleware, postLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
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

export default router;

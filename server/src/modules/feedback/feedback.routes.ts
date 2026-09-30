import { Router } from "express";
import prisma from "../../db/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { feedbackLimiter } from "../../middleware/rateLimit";
import { sendEmail } from "../../lib/email";
import { escapeHtml } from "../../lib/html";
import { HttpError } from "../../lib/httpError";

const router = Router();

const KINDS: Record<string, string> = {
  idea: "Idea",
  problem: "Problem",
  question: "Question",
  other: "Other",
};

// Feedback from Settings is emailed to the team (FEEDBACK_EMAIL, or the sending address),
// with the user's email as reply-to so answering is one click
router.post("/", authMiddleware, feedbackLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const kind = KINDS[String(req.body.kind)];
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
  if (!kind) return res.status(400).json({ error: "Choose what your feedback is about" });
  if (message.length < 10 || message.length > 2000) {
    return res.status(400).json({ error: "Your message should be 10 to 2000 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { username: true, email: true } });
  if (!user) return res.status(404).json({ error: "Account not found" });

  const to = process.env.FEEDBACK_EMAIL ?? process.env.EMAIL_FROM ?? "feedback@localhost";
  const subject = `[Feedback: ${kind}] from ${user.username}`;
  try {
    await sendEmail({
      to,
      replyTo: user.email,
      subject,
      text: `${kind} from ${user.username} (${user.email})\n\n${message}`,
      html: `<p><strong>${kind}</strong> from ${escapeHtml(user.username)} (${escapeHtml(user.email)})</p>
<p style="white-space: pre-wrap;">${escapeHtml(message)}</p>`,
    });
  } catch (err) {
    console.error("Feedback email failed", err);
    throw new HttpError(502, "We couldn't send your message right now. Please try again later.");
  }
  res.status(200).json({ success: true });
});

export default router;

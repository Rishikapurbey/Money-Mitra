import { Router } from "express";
import { signupUser, loginUser } from "./auth.service";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import prisma from "../../db/prisma";
import { avatarUrl, coverUrl } from "../../lib/identity";
import { forgotPasswordLimiter, loginLimiter, resetPasswordLimiter, signupLimiter, verifyEmailLimiter, resendVerificationLimiter } from "../../middleware/rateLimit";
import { requestPasswordReset, resetPassword } from "./passwordReset.service";
import { pendingEmail, sendVerificationEmail, verifyEmail } from "./emailVerification.service";
import { text, emailProblem, usernameProblem, passwordProblem } from "../../lib/validation";

const router = Router();

function validateSignup(email: string, username: string, password: string): string | null {
  if (!email || !username || !password) return "Email, username, and password are required";
  return emailProblem(email) ?? usernameProblem(username) ?? passwordProblem(password);
}

router.post("/signup", signupLimiter, async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const username = text(req.body.username);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  const problem = validateSignup(email, username, password);
  if (problem) return res.status(400).json({ error: problem });

  const user = await signupUser(email, username, password);
  await sendVerificationEmail(user.id);
  res.status(201).json({ user });
});

router.post("/login", loginLimiter, async (req, res) => {
  const email = text(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const result = await loginUser(email, password);
  res.status(200).json(result);
});

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const problem = emailProblem(email);
  if (problem) return res.status(400).json({ error: problem });
  await requestPasswordReset(email);
  res.status(200).json({ message: "If an account exists for that email, we've sent a reset link." });
});

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const token = text(req.body.token);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!token) return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  await resetPassword(token, password);
  res.status(200).json({ success: true });
});

router.post("/verify-email", verifyEmailLimiter, async (req, res) => {
  const token = text(req.body.token);
  if (!token) return res.status(400).json({ error: "This link is invalid or has expired. Log in and send yourself a new one." });
  const { changedTo } = await verifyEmail(token);
  res.status(200).json({ success: true, changedTo });
});

router.post("/resend-verification", authMiddleware, resendVerificationLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await sendVerificationEmail(req.userId);
  res.status(200).json({ message: "We've sent a new link. Please check your inbox." });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      username: true,
      createdAt: true,
      emailReplies: true,
      budgetAlerts: true,
      emailBudgetAlerts: true,
      netWorthReminder: true,
      displayName: true,
      bio: true,
      isPrivate: true,
      anonymousByDefault: true,
      avatarUpdatedAt: true,
      coverUpdatedAt: true,
      coverPreset: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { avatarUpdatedAt, coverUpdatedAt, emailVerifiedAt, ...rest } = user;
  res.status(200).json({
    user: {
      ...rest,
      emailVerified: emailVerifiedAt !== null,
      pendingEmail: await pendingEmail(user.id),
      avatarUrl: avatarUrl({ username: user.username, avatarUpdatedAt }),
      coverUrl: coverUrl({ username: user.username, coverUpdatedAt }),
    },
  });
});
export default router;
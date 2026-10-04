import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { accountLimiter, emailChangeLimiter, photoLimiter, resendVerificationLimiter } from "../../middleware/rateLimit";
import { emailProblem, passwordProblem, text, usernameProblem } from "../../lib/validation";
import { changeEmail, changePassword, changeUsername, deleteAccount, exportData, logoutEverywhere, setNotificationPreferences } from "./account.service";
import type { NotificationPreferences } from "./account.service";

import {
  MAX_BIO,
  displayNameProblem,
  parsePhoto,
  removePhoto,
  setPhoto,
  updatePrivacy,
  updateProfile,
} from "../profiles/profile.service";
import { cancelEmailChange, resendEmailChange } from "../auth/emailVerification.service";

const router = Router();

const password = (value: unknown) => (typeof value === "string" ? value : "");

router.put("/password", authMiddleware, accountLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const current = password(req.body.currentPassword);
  const next = password(req.body.newPassword);
  if (!current) return res.status(400).json({ error: "Enter your current password" });
  const problem = passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem });
  if (current === next) return res.status(400).json({ error: "Your new password must be different" });
  const token = await changePassword(req.userId, current, next);
  res.status(200).json({ token });
});

router.put("/email", authMiddleware, emailChangeLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const email = text(req.body.email).toLowerCase();
  const current = password(req.body.password);
  const problem = emailProblem(email);
  if (problem) return res.status(400).json({ error: problem });
  if (!current) return res.status(400).json({ error: "Enter your current password" });
  await changeEmail(req.userId, current, email);
  res.status(200).json({ pendingEmail: email });
});

router.post("/email/resend", authMiddleware, resendVerificationLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await resendEmailChange(req.userId);
  res.status(200).json({ message: "We've sent a new link. Please check your inbox." });
});

router.delete("/email/pending", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await cancelEmailChange(req.userId);
  res.status(200).json({ success: true });
});

router.post("/logout-everywhere", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ token: await logoutEverywhere(req.userId) });
});

router.put("/username", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const username = text(req.body.username);
  const problem = usernameProblem(username);
  if (problem) return res.status(400).json({ error: problem });
  const user = await changeUsername(req.userId, username);
  res.status(200).json({ user });
});

// Name and bio on the public profile; empty values clear them
router.put("/profile", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const displayName = text(req.body.displayName).replace(/\s+/g, " ");
  const bio = text(req.body.bio);
  const problem = displayNameProblem(displayName);
  if (problem) return res.status(400).json({ error: problem });
  if (bio.length > MAX_BIO) return res.status(400).json({ error: `Your bio can be up to ${MAX_BIO} characters` });
  const profile = await updateProfile(req.userId, { displayName: displayName || null, bio: bio || null });
  res.status(200).json({ profile });
});

router.put("/photo", authMiddleware, photoLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const photo = parsePhoto(typeof req.body.image === "string" ? req.body.image : "");
  res.status(200).json({ avatarUrl: await setPhoto(req.userId, photo) });
});

router.delete("/photo", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await removePhoto(req.userId);
  res.status(200).json({ avatarUrl: null });
});

router.put("/privacy", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const changes: { isPrivate?: boolean; anonymousByDefault?: boolean } = {};
  for (const key of ["isPrivate", "anonymousByDefault"] as const) {
    const value = req.body[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") return res.status(400).json({ error: `${key} must be true or false` });
    changes[key] = value;
  }
  if (Object.keys(changes).length === 0) return res.status(400).json({ error: "Nothing to change" });
  const privacy = await updatePrivacy(req.userId, changes);
  res.status(200).json(privacy);
});

// Named before budget alerts existed; covers every notification setting
router.put("/email-preferences", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const changes: NotificationPreferences = {};
  for (const key of ["emailReplies", "budgetAlerts", "emailBudgetAlerts", "netWorthReminder"] as const) {
    const value = req.body[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") return res.status(400).json({ error: `${key} must be true or false` });
    changes[key] = value;
  }
  if (Object.keys(changes).length === 0) return res.status(400).json({ error: "Nothing to change" });
  res.status(200).json(await setNotificationPreferences(req.userId, changes));
});

router.get("/export", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const data = await exportData(req.userId);
  res.status(200).json({ data });
});

router.delete("/", authMiddleware, accountLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const current = password(req.body.password);
  if (!current) return res.status(400).json({ error: "Enter your password to confirm" });
  await deleteAccount(req.userId, current);
  res.status(200).json({ success: true });
});

export default router;

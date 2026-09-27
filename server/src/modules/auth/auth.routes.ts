import { Router } from "express";
import { signupUser, loginUser } from "./auth.service";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import prisma from "../../db/prisma";
import { loginLimiter, signupLimiter } from "../../middleware/rateLimit";

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
// Names that could be mistaken for the app, staff, or an anonymous poster
const RESERVED_USERNAMES = ["anonymous", "admin", "administrator", "moderator", "mod", "moneymitra", "money_mitra", "support", "system", "you"];

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function validateSignup(email: string, username: string, password: string): string | null {
  if (!email || !username || !password) return "Email, username, and password are required";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Please enter a valid email address";
  if (!USERNAME_PATTERN.test(username)) {
    return "Username must be 3 to 20 characters: letters, numbers and underscores only";
  }
  if (RESERVED_USERNAMES.includes(username.toLowerCase())) return "That username isn't available";
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently cut
  if (password.length < 8 || password.length > 72) return "Password must be 8 to 72 characters";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number";
  }
  return null;
}

router.post("/signup", signupLimiter, async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const username = text(req.body.username);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  const problem = validateSignup(email, username, password);
  if (problem) return res.status(400).json({ error: problem });

  const user = await signupUser(email, username, password);
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

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.status(200).json({ user });
});
export default router;

import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { HttpError } from "./lib/httpError";
import authRoutes from "./modules/auth/auth.routes";
import transactionRoutes from "./modules/transactions/transaction.routes";
import postRoutes from "./modules/posts/post.routes";
import budgetRoutes from "./modules/budgets/budget.routes";
import goalRoutes from "./modules/goals/goal.routes";
import accountRoutes from "./modules/account/account.routes";
import notificationRoutes from "./modules/notifications/notification.routes";

dotenv.config();

// Warn rather than crash, so a weak secret can't take the site down
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.warn("WARNING: JWT_SECRET is missing or shorter than 32 characters. Set a long random value.");
}

// Browsers may only call the API from these sites. Extra origins can be added
// with ALLOWED_ORIGINS (comma-separated) without a code change.
const allowedOrigins = [
  "https://money-mitra-three.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
];

const app = express();
// Render sits in front of the app as a proxy; this lets rate limits see the real client IP
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Money Mitra API is running" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Expected errors (HttpError) are shown to the user; anything else is logged
// and replaced with a generic message so internal details never leak
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  const status = (err as { status?: number }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json({ error: "Invalid request" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;

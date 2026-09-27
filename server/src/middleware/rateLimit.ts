import rateLimit from "express-rate-limit";

const limiter = (windowMinutes: number, limit: number, message: string, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: message },
  });

// Only failed logins count, so people who log in successfully are never blocked
export const loginLimiter = limiter(15, 10, "Too many login attempts. Please try again in 15 minutes.", true);

export const signupLimiter = limiter(60, 5, "Too many accounts created from this network. Please try again later.");

// Password checks for changing the password or deleting the account; only failures count
export const accountLimiter = limiter(15, 10, "Too many attempts. Please try again in 15 minutes.", true);

export const postLimiter = limiter(10, 30, "You're posting very quickly. Please wait a few minutes and try again.");

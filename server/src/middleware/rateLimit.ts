import rateLimit from "express-rate-limit";

const limiter = (windowMinutes: number, limit: number, message: string, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: message },
    // The test suite makes many requests from one address; limits are tested separately by hand
    skip: () => process.env.NODE_ENV === "test",
  });

// Only failed logins count, so people who log in successfully are never blocked
export const loginLimiter = limiter(15, 10, "Too many login attempts. Please try again in 15 minutes.", true);

export const signupLimiter = limiter(60, 5, "Too many accounts created from this network. Please try again later.");

// Password checks for changing the password or deleting the account; only failures count
export const accountLimiter = limiter(15, 10, "Too many attempts. Please try again in 15 minutes.", true);

// Reset emails: every request counts, to stop the form being used to spam someone's inbox
export const forgotPasswordLimiter = limiter(15, 5, "Too many reset requests. Please try again in 15 minutes.");

export const resetPasswordLimiter = limiter(15, 10, "Too many attempts. Please try again in 15 minutes.", true);

export const reportLimiter = limiter(60, 20, "You've sent a lot of reports. Please try again later.");

export const postLimiter = limiter(10, 30, "You're posting very quickly. Please wait a few minutes and try again.");

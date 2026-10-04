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

export const verifyEmailLimiter = limiter(15, 10, "Too many attempts. Please try again in 15 minutes.", true);

// Every resend counts, to stop it being used to flood an inbox
export const resendVerificationLimiter = limiter(15, 3, "We've sent a few links already. Please check your inbox or try again in 15 minutes.");

// Every request counts: each one checks the password and emails an address the user typed
export const emailChangeLimiter = limiter(15, 5, "Too many attempts. Please try again in 15 minutes.");

export const reportLimiter = limiter(60, 20, "You've sent a lot of reports. Please try again later.");

export const postLimiter = limiter(10, 30, "You're posting very quickly. Please wait a few minutes and try again.");

export const feedbackLimiter = limiter(60, 5, "You've sent a lot of feedback recently. Please try again in an hour.");

export const photoLimiter = limiter(60, 20, "You've changed your photo a lot recently. Please try again in an hour.");

export const followLimiter = limiter(10, 60, "You're following and unfollowing very quickly. Please wait a few minutes.");

// Each import can add thousands of rows, so a handful an hour is plenty
export const importLimiter = limiter(60, 20, "You've imported a lot of files recently. Please try again in an hour.");

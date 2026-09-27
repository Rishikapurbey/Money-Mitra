import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { sendEmail } from "../../lib/email";
import { DELETED_USERNAME } from "../../lib/validation";

const LINK_LIFETIME_MINUTES = 30;

// Usernames created before signup validation existed could contain HTML characters
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function resetEmail(username: string, link: string) {
  const text = [
    `Hi ${username},`,
    "",
    "We received a request to reset your Money Mitra password. Use this link to choose a new one:",
    link,
    "",
    `The link works once and expires in ${LINK_LIFETIME_MINUTES} minutes.`,
    "If you didn't ask for this, you can ignore this email. Your password won't change.",
  ].join("\n");

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f1b2d;">
    <h2 style="margin-bottom: 8px;">Reset your password</h2>
    <p>Hi ${escapeHtml(username)},</p>
    <p>We received a request to reset your Money Mitra password.</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background: #0f6f67; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: bold;">
        Choose a new password
      </a>
    </p>
    <p style="color: #64748b; font-size: 14px;">The link works once and expires in ${LINK_LIFETIME_MINUTES} minutes.
    If you didn't ask for this, you can ignore this email. Your password won't change.</p>
  </div>`;

  return { text, html };
}

// Always resolves the same way whether or not the email has an account, so the
// form can't be used to discover who is registered. The email is sent in the
// background so response time doesn't reveal it either.
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, NOT: { username: DELETED_USERNAME } },
  });
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LINK_LIFETIME_MINUTES * 60 * 1000),
    },
  });

  const appUrl = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
  const link = `${appUrl}/reset-password?token=${token}`;
  const { text, html } = resetEmail(user.username, link);
  sendEmail({ to: user.email, subject: "Reset your Money Mitra password", text, html }).catch((err) =>
    console.error("Password reset email failed:", err)
  );
}

// Sets the new password, uses up every outstanding link, and logs out all sessions
export async function resetPassword(token: string, newPassword: string) {
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new HttpError(400, "This reset link is invalid or has expired. Please request a new one.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
    prisma.passwordReset.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
}

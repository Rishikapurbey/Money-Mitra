import { createHash, randomBytes } from "crypto";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { sendEmail } from "../../lib/email";
// Usernames created before signup validation existed could contain HTML characters
import { escapeHtml } from "../../lib/html";

const LINK_LIFETIME_HOURS = 24;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function verificationEmail(username: string, link: string) {
  const text = [
    `Hi ${username},`,
    "",
    "Please confirm this is your email address for Money Mitra by opening this link:",
    link,
    "",
    `The link expires in ${LINK_LIFETIME_HOURS} hours.`,
    "If you didn't create a Money Mitra account, you can ignore this email.",
  ].join("\n");

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f1b2d;">
    <h2 style="margin-bottom: 8px;">Confirm your email</h2>
    <p>Hi ${escapeHtml(username)},</p>
    <p>Please confirm this is your email address for Money Mitra.</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background: #0f6f67; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: bold;">
        Confirm my email
      </a>
    </p>
    <p style="color: #64748b; font-size: 14px;">The link expires in ${LINK_LIFETIME_HOURS} hours.
    If you didn't create a Money Mitra account, you can ignore this email.</p>
  </div>`;

  return { text, html };
}

// Sends a fresh confirmation link; the email goes in the background so a slow
// email service never holds up signup
export async function sendVerificationEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LINK_LIFETIME_HOURS * 60 * 60 * 1000),
    },
  });

  const appUrl = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
  const link = `${appUrl}/verify-email?token=${token}`;
  const { text, html } = verificationEmail(user.username, link);
  sendEmail({ to: user.email, subject: "Confirm your email for Money Mitra", text, html }).catch((err) =>
    console.error("Verification email failed:", err)
  );
}

// Marks the email confirmed and uses up every outstanding link
export async function verifyEmail(token: string) {
  const verification = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { emailVerifiedAt: true } } },
  });
  // Opening the same link again after it worked is not an error
  if (verification?.user.emailVerifiedAt) return;
  if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
    throw new HttpError(400, "This link is invalid or has expired. Log in and send yourself a new one.");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: verification.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerification.updateMany({
      where: { userId: verification.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
}

// For actions that need a confirmed email, such as posting in Discuss
export async function requireVerifiedEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!user?.emailVerifiedAt) {
    throw new HttpError(403, "Please confirm your email before posting. We sent you a link when you signed up.");
  }
}

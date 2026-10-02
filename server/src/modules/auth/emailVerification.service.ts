import { createHash, randomBytes } from "crypto";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { sendEmail } from "../../lib/email";
// Usernames created before signup validation existed could contain HTML characters
import { escapeHtml } from "../../lib/html";

const LINK_LIFETIME_HOURS = 24;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const appUrl = () => (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");

// "n•••@gmail.com", so the notice to an old address doesn't hand over the new one in full
export const maskEmail = (email: string) => {
  const at = email.lastIndexOf("@");
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
};

function verificationEmail(username: string, link: string, changing: boolean) {
  const intro = changing
    ? "Please confirm this is the new email address for your Money Mitra account by opening this link:"
    : "Please confirm this is your email address for Money Mitra by opening this link:";
  const ignore = changing
    ? "If you didn't ask to change your email, you can ignore this email. Nothing will change."
    : "If you didn't create a Money Mitra account, you can ignore this email.";
  const text = [`Hi ${username},`, "", intro, link, "", `The link expires in ${LINK_LIFETIME_HOURS} hours.`, ignore].join("\n");

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f1b2d;">
    <h2 style="margin-bottom: 8px;">${changing ? "Confirm your new email" : "Confirm your email"}</h2>
    <p>Hi ${escapeHtml(username)},</p>
    <p>${changing ? "Please confirm this is the new email address for your Money Mitra account." : "Please confirm this is your email address for Money Mitra."}</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background: #0f6f67; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: bold;">
        Confirm my email
      </a>
    </p>
    <p style="color: #64748b; font-size: 14px;">The link expires in ${LINK_LIFETIME_HOURS} hours. ${ignore}</p>
  </div>`;

  return { text, html };
}

function changedNotice(username: string, newEmail: string) {
  const masked = maskEmail(newEmail);
  const text = [
    `Hi ${username},`,
    "",
    `The email address for your Money Mitra account was changed to ${masked}. From now on, log in with the new address.`,
    "",
    "If you didn't make this change, reply to this email and we'll help you get your account back.",
  ].join("\n");

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f1b2d;">
    <h2 style="margin-bottom: 8px;">Your email was changed</h2>
    <p>Hi ${escapeHtml(username)},</p>
    <p>The email address for your Money Mitra account was changed to <strong>${escapeHtml(masked)}</strong>.
    From now on, log in with the new address.</p>
    <p style="color: #64748b; font-size: 14px;">If you didn't make this change, reply to this email and we'll help you get your account back.</p>
  </div>`;

  return { text, html };
}

// Creates a link and emails it in the background, so a slow email service never holds up the request.
// With newEmail, the link confirms a change to that address and is sent there.
async function sendLink(user: { id: string; username: string; email: string }, newEmail: string | null) {
  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      email: newEmail,
      expiresAt: new Date(Date.now() + LINK_LIFETIME_HOURS * 60 * 60 * 1000),
    },
  });

  const link = `${appUrl()}/verify-email?token=${token}`;
  const { text, html } = verificationEmail(user.username, link, newEmail !== null);
  const subject = newEmail ? "Confirm your new email for Money Mitra" : "Confirm your email for Money Mitra";
  sendEmail({ to: newEmail ?? user.email, subject, text, html }).catch((err) => console.error("Verification email failed:", err));
}

// Sends a fresh link to confirm the email the account already has
export async function sendVerificationEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return;
  await sendLink(user, null);
}

const emailTakenBy = (email: string, userId: string) =>
  prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, NOT: { id: userId } } });

// Starts a change of address: the account keeps its current email until the new one is confirmed.
// A new request replaces any earlier one.
export async function requestEmailChange(user: { id: string; username: string; email: string }, newEmail: string) {
  if (newEmail.toLowerCase() === user.email.toLowerCase()) {
    throw new HttpError(400, "That's already your email address");
  }
  if (await emailTakenBy(newEmail, user.id)) {
    throw new HttpError(409, "That email is already used by another account");
  }
  await cancelEmailChange(user.id);
  await sendLink(user, newEmail);
}

// The address waiting to be confirmed, if its link hasn't expired
export async function pendingEmail(userId: string) {
  const pending = await prisma.emailVerification.findFirst({
    where: { userId, email: { not: null }, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return pending?.email ?? null;
}

export async function resendEmailChange(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const email = await pendingEmail(userId);
  if (!user || !email) throw new HttpError(404, "There's no email change waiting. Start a new one.");
  await cancelEmailChange(userId);
  await sendLink(user, email);
}

export async function cancelEmailChange(userId: string) {
  await prisma.emailVerification.updateMany({
    where: { userId, email: { not: null }, usedAt: null },
    data: { usedAt: new Date() },
  });
}

const INVALID_LINK = "This link is invalid or has expired. Log in and send yourself a new one.";

// Confirms the email the link was sent to. Returns the address now on the account when the link changed it.
export async function verifyEmail(token: string): Promise<{ changedTo: string | null }> {
  const verification = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!verification) throw new HttpError(400, INVALID_LINK);
  const { user, email: newEmail } = verification;

  if (verification.usedAt) {
    // Opening the same link again after it worked is not an error
    const alreadyDone = newEmail ? user.email === newEmail : user.emailVerifiedAt !== null;
    if (alreadyDone) return { changedTo: newEmail };
    throw new HttpError(400, INVALID_LINK);
  }
  if (verification.expiresAt < new Date()) throw new HttpError(400, INVALID_LINK);

  if (!newEmail) {
    if (!user.emailVerifiedAt) {
      // A pending change of address stays open; only signup links are used up
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
        prisma.emailVerification.updateMany({ where: { userId: user.id, email: null, usedAt: null }, data: { usedAt: new Date() } }),
      ]);
    }
    return { changedTo: null };
  }

  // Someone may have signed up with the address since the change was requested
  if (await emailTakenBy(newEmail, user.id)) {
    throw new HttpError(409, "That email is now used by another account. Please choose a different one in Settings.");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { email: newEmail, emailVerifiedAt: new Date() } }),
    prisma.emailVerification.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
  ]);

  const { text, html } = changedNotice(user.username, newEmail);
  sendEmail({
    to: user.email,
    subject: "Your Money Mitra email was changed",
    text,
    html,
    replyTo: process.env.ADMIN_EMAIL,
  }).catch((err) => console.error("Email change notice failed:", err));
  return { changedTo: newEmail };
}

// For actions that need a confirmed email, such as posting in Discuss
export async function requireVerifiedEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!user?.emailVerifiedAt) {
    throw new HttpError(403, "Please confirm your email before posting. We sent you a link when you signed up.");
  }
}

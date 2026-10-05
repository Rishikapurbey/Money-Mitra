import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { DELETED_USERNAME } from "../../lib/validation";
import { signToken } from "../../lib/tokens";
import { avatarUrl } from "../../lib/identity";
import { requestEmailChange } from "../auth/emailVerification.service";

async function verifyPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Account not found");
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    // 400 rather than 401: the client treats 401 as an expired session and logs the user out
    throw new HttpError(400, "Your password is incorrect");
  }
  return user;
}

// Sends a confirm link to the new address; the email only changes once it's opened
export async function changeEmail(userId: string, password: string, newEmail: string) {
  const user = await verifyPassword(userId, password);
  await requestEmailChange(user, newEmail);
}

// Logs out every other session, and returns a fresh token so this device stays logged in
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  await verifyPassword(userId, currentPassword);
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
  return signToken(user);
}

// Every existing login stops working; returns a fresh token so this device stays logged in
export async function logoutEverywhere(userId: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  return signToken(user);
}

export async function changeUsername(userId: string, username: string) {
  const taken = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, NOT: { id: userId } },
  });
  if (taken) throw new HttpError(409, "That username is already taken");
  const user = await prisma.user.update({ where: { id: userId }, data: { username } });
  // The photo's address includes the username, so it changes too
  return { id: user.id, email: user.email, username: user.username, avatarUrl: avatarUrl(user) };
}

export interface NotificationPreferences {
  emailReplies?: boolean;
  budgetAlerts?: boolean;
  emailBudgetAlerts?: boolean;
  netWorthReminder?: boolean;
}

export async function setNotificationPreferences(userId: string, changes: NotificationPreferences) {
  return prisma.user.update({
    where: { id: userId },
    data: changes,
    select: { emailReplies: true, budgetAlerts: true, emailBudgetAlerts: true, netWorthReminder: true },
  });
}

// Everything stored for this user, without the password hash
export async function exportData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      username: true,
      displayName: true,
      bio: true,
      isPrivate: true,
      anonymousByDefault: true,
      createdAt: true,
      transactions: { orderBy: { date: "desc" }, select: { amount: true, type: true, category: true, note: true, date: true } },
      categories: { orderBy: { name: "asc" }, select: { name: true, type: true } },
      budgets: { select: { category: true, amount: true, createdAt: true } },
      goals: {
        select: {
          name: true,
          targetAmount: true,
          savedAmount: true,
          targetDate: true,
          createdAt: true,
          contributions: { select: { amount: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        },
      },
      recurring: {
        select: { amount: true, type: true, category: true, note: true, mode: true, frequency: true, dayOfMonth: true, monthOfYear: true, endDate: true, paused: true },
      },
      netWorthItems: {
        select: {
          name: true,
          kind: true,
          type: true,
          value: true,
          archivedAt: true,
          createdAt: true,
          values: { select: { value: true, recordedAt: true }, orderBy: { recordedAt: "asc" } },
        },
      },
      posts: { select: { title: true, body: true, topic: true, isAnonymous: true, createdAt: true } },
      replies: { select: { body: true, isAnonymous: true, createdAt: true, post: { select: { title: true } } } },
      following: { select: { status: true, createdAt: true, following: { select: { username: true } } } },
      followers: { select: { status: true, createdAt: true, follower: { select: { username: true } } } },
    },
  });
  if (!user) throw new HttpError(404, "Account not found");
  return { exportedAt: new Date().toISOString(), ...user };
}

// The placeholder account that keeps Discuss posts readable after their author leaves.
// It has a random password nobody knows, so it can never be logged into.
async function deletedUserId() {
  const existing = await prisma.user.findUnique({ where: { username: DELETED_USERNAME } });
  if (existing) return existing.id;
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const created = await prisma.user.create({
    data: { username: DELETED_USERNAME, email: "deleted-user@moneymitra.invalid", passwordHash },
  });
  return created.id;
}

// Permanently removes the account and private data; Discuss posts stay as "Deleted user"
export async function deleteAccount(userId: string, password: string) {
  await verifyPassword(userId, password);
  const placeholderId = await deletedUserId();
  await prisma.$transaction([
    prisma.post.updateMany({ where: { authorId: userId }, data: { authorId: placeholderId } }),
    prisma.reply.updateMany({ where: { authorId: userId }, data: { authorId: placeholderId } }),
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.recurringTransaction.deleteMany({ where: { userId } }),
    prisma.budget.deleteMany({ where: { userId } }),
    prisma.goal.deleteMany({ where: { userId } }),
    prisma.category.deleteMany({ where: { userId } }),
    prisma.passwordReset.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}

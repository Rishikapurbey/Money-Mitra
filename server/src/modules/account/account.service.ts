import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { DELETED_USERNAME } from "../../lib/validation";
import { signToken } from "../../lib/tokens";

async function verifyPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Account not found");
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    // 400 rather than 401: the client treats 401 as an expired session and logs the user out
    throw new HttpError(400, "Your password is incorrect");
  }
  return user;
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
  return { id: user.id, email: user.email, username: user.username };
}

export async function setEmailPreferences(userId: string, emailReplies: boolean) {
  const user = await prisma.user.update({ where: { id: userId }, data: { emailReplies }, select: { emailReplies: true } });
  return user;
}

// Everything stored for this user, without the password hash
export async function exportData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      username: true,
      createdAt: true,
      transactions: { orderBy: { date: "desc" }, select: { amount: true, type: true, category: true, note: true, date: true } },
      categories: { orderBy: { name: "asc" }, select: { name: true, type: true } },
      budgets: { select: { category: true, amount: true, createdAt: true } },
      goals: { select: { name: true, targetAmount: true, savedAmount: true, targetDate: true, createdAt: true } },
      recurring: { select: { amount: true, type: true, category: true, note: true, dayOfMonth: true, endDate: true, paused: true } },
      posts: { select: { title: true, body: true, topic: true, isAnonymous: true, createdAt: true } },
      replies: { select: { body: true, isAnonymous: true, createdAt: true, post: { select: { title: true } } } },
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

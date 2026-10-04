import request from "supertest";
import app from "../src/app";
import prisma from "../src/db/prisma";

export const api = () => request(app);

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Notification", "ReplyVote", "Report", "Reply", "Post", "Transaction", "Import", "GoalContribution", "NetWorthValue", "NetWorthItem", "Budget", "Goal", "PasswordReset", "EmailVerification", "BudgetAlert", "RecurringTransaction", "Category", "User" CASCADE'
  );
}

let counter = 0;

// Creates a user with a confirmed email and returns their login token
export async function createUser(prefix = "user", { verified = true } = {}) {
  counter += 1;
  const username = `${prefix}_${counter}_${Date.now() % 100000}`;
  const email = `${username}@example.com`;
  const password = "Password123";
  await api().post("/api/auth/signup").send({ email, username, password }).expect(201);
  if (verified) await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  const res = await api().post("/api/auth/login").send({ email, password }).expect(200);
  return { token: res.body.token as string, email, username, password, auth: `Bearer ${res.body.token}` };
}

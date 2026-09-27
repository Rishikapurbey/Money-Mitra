import request from "supertest";
import app from "../src/app";
import prisma from "../src/db/prisma";

export const api = () => request(app);

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Reply", "Post", "Transaction", "Budget", "Goal", "PasswordReset", "User" CASCADE'
  );
}

let counter = 0;

// Creates a user and returns their login token
export async function createUser(prefix = "user") {
  counter += 1;
  const username = `${prefix}_${counter}_${Date.now() % 100000}`;
  const email = `${username}@example.com`;
  const password = "Password123";
  await api().post("/api/auth/signup").send({ email, username, password }).expect(201);
  const res = await api().post("/api/auth/login").send({ email, password }).expect(200);
  return { token: res.body.token as string, email, username, password, auth: `Bearer ${res.body.token}` };
}

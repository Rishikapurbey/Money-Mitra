import bcrypt from "bcryptjs";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import jwt from "jsonwebtoken";

export async function signupUser(email: string, username: string, password: string) {
  // Emails and usernames are unique regardless of capitalisation
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        { username: { equals: username, mode: "insensitive" } },
      ],
    },
  });

  if (existingUser) {
    throw new HttpError(409, "Email or username already in use");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
    },
  });

  return {
    id: user.id,
    email: user.email,
    username: user.username,
  };
}

export async function loginUser(email: string, password: string) {
  // Case-insensitive so accounts created before emails were lowercased still work
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new HttpError(401, "Invalid email or password");
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
  };
}
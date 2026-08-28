import bcrypt from "bcryptjs";
import prisma from "../../db/prisma";

export async function signupUser(email: string, username: string, password: string) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    throw new Error("Email or username already in use");
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
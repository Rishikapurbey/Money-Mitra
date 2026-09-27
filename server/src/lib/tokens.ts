import jwt from "jsonwebtoken";

// The token carries the user's tokenVersion; bumping it in the database logs out every existing session
export function signToken(user: { id: string; tokenVersion: number }) {
  return jwt.sign({ userId: user.id, v: user.tokenVersion }, process.env.JWT_SECRET as string, { expiresIn: "7d" });
}

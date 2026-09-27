import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db/prisma";

export interface AuthRequest extends Request {
  userId?: string;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

 const token = authHeader.split(" ")[1];
 const secret = process.env.JWT_SECRET;

 if (!token) {
   return res.status(401).json({ error: "No token provided" });
 }
  if (!secret) {
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  let decoded: { userId: string; v?: number };
  try {
    decoded = jwt.verify(token, secret) as unknown as { userId: string; v?: number };
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Reject sessions for deleted accounts, and sessions from before a password change or reset.
  // Tokens issued before tokenVersion existed carry no "v" and count as version 0.
  const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { tokenVersion: true } });
  if (!user || (decoded.v ?? 0) !== user.tokenVersion) {
    return res.status(401).json({ error: "Your session has ended. Please log in again." });
  }

  req.userId = decoded.userId;
  next();
}
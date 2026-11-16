import { Router } from "express";
import prisma from "../../db/prisma";
import { identity } from "../../lib/identity";
import { text } from "../../lib/validation";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { peopleSearchLimiter } from "../../middleware/rateLimit";
import { matchPeople } from "./people";

const router = Router();

export const MIN_PEOPLE_SEARCH = 2;
const PEOPLE_LIMIT = 20;

// The search page: people by name or @username, with how the viewer is connected to each.
// Only public identity is returned, the same as a profile shows; private profiles are listed too.
router.get("/people", authMiddleware, peopleSearchLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const viewerId = req.userId;
  const people = await matchPeople(viewerId, text(req.query.q), { minLength: MIN_PEOPLE_SEARCH, limit: PEOPLE_LIMIT });
  const ids = people.map((p) => p.id);
  const follows = ids.length
    ? await prisma.follow.findMany({
        where: { OR: [{ followerId: viewerId, followingId: { in: ids } }, { followingId: viewerId, followerId: { in: ids }, status: "accepted" }] },
        select: { followerId: true, followingId: true, status: true },
      })
    : [];
  res.status(200).json({
    people: people.map((p) => {
      const mine = follows.find((f) => f.followerId === viewerId && f.followingId === p.id);
      return {
        ...identity(p),
        // "accepted" when the viewer follows them, "pending" while a request waits, else null
        following: (mine?.status ?? null) as "accepted" | "pending" | null,
        followsYou: follows.some((f) => f.followerId === p.id),
      };
    }),
  });
});

export default router;

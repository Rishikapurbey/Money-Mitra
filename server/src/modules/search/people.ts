import type { Prisma } from "@prisma/client";
import prisma from "../../db/prisma";
import { DELETED_USERNAME } from "../../lib/validation";
import { identitySelect } from "../../lib/identity";

const MAX_QUERY = 40;

// People whose username or display name starts with `query` (or a later word of the name does).
// People the viewer already knows (follows either way, or shares a group with) come first, then an
// exact username, then the rest alphabetically. Never the viewer or the deleted-user placeholder.
// Only id and public identity are selected. Used by the search page and the group invite field.
export async function matchPeople(userId: string, query: string, { minLength, limit }: { minLength: number; limit: number }) {
  const q = query.trim().replace(/^@/, "");
  if (q.length < minLength || q.length > MAX_QUERY) return [];

  const matches: Prisma.UserWhereInput = {
    OR: [
      { username: { startsWith: q, mode: "insensitive" } },
      { displayName: { startsWith: q, mode: "insensitive" } },
      { displayName: { contains: ` ${q}`, mode: "insensitive" } },
    ],
    NOT: [{ id: userId }, { username: DELETED_USERNAME }],
  };
  const [follows, groupmates] = await Promise.all([
    prisma.follow.findMany({
      where: { status: "accepted", OR: [{ followerId: userId }, { followingId: userId }] },
      select: { followerId: true, followingId: true },
    }),
    prisma.groupMember.findMany({
      where: { status: "active", userId: { not: null }, group: { members: { some: { userId, status: "active" } } } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);
  const known = new Set([...follows.flatMap((f) => [f.followerId, f.followingId]), ...groupmates.map((m) => m.userId as string)]);
  known.delete(userId);

  const select = { id: true, ...identitySelect } as const;
  const [close, exact, others] = await Promise.all([
    prisma.user.findMany({ where: { AND: [matches, { id: { in: [...known] } }] }, select, take: limit, orderBy: { username: "asc" } }),
    prisma.user.findFirst({ where: { AND: [matches, { username: { equals: q, mode: "insensitive" } }] }, select }),
    prisma.user.findMany({ where: matches, select, take: limit * 2, orderBy: { username: "asc" } }),
  ]);
  const lower = q.toLowerCase();
  const rank = (u: { id: string; username: string }) =>
    known.has(u.id) ? 0 : u.username.toLowerCase() === lower ? 1 : u.username.toLowerCase().startsWith(lower) ? 2 : 3;
  return [...new Map([...close, ...(exact ? [exact] : []), ...others].map((u) => [u.id, u])).values()]
    .sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username))
    .slice(0, limit);
}

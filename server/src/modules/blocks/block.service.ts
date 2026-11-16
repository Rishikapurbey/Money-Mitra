import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { identity, identitySelect } from "../../lib/identity";
import { findPerson } from "../follows/follow.service";

// Blocking cuts all contact both ways: no messages or follows, no profile or activity, no group
// invites, and neither person finds the other in search. The blocked person is never told; to them
// it looks as if the account can't be reached.

// Whether either person has blocked the other, and which way
export async function blockBetween(viewerId: string, otherId: string) {
  if (viewerId === otherId) return { byMe: false, byThem: false };
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId, blockedId: otherId }, { blockerId: otherId, blockedId: viewerId }] },
    select: { blockerId: true },
  });
  return { byMe: blocks.some((b) => b.blockerId === viewerId), byThem: blocks.some((b) => b.blockerId === otherId) };
}

// Everyone this person has blocked or been blocked by, to leave out of search
export async function blockedIds(userId: string) {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
}

// Throws the answer someone gets when a block stands between them and another person. Someone
// who was blocked sees the same "not found" as for an account that doesn't exist.
export async function refuseIfBlocked(viewerId: string, otherId: string, whenMine: string, notFound = "Profile not found") {
  const { byMe, byThem } = await blockBetween(viewerId, otherId);
  if (byThem) throw new HttpError(404, notFound);
  if (byMe) throw new HttpError(400, whenMine);
}

export async function block(userId: string, username: string) {
  const person = await findPerson(username);
  if (person.id === userId) throw new HttpError(400, "You can't block yourself");
  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: person.id } },
      create: { blockerId: userId, blockedId: person.id },
      update: {},
    }),
    // Follows and follow requests between them end, both ways
    prisma.follow.deleteMany({
      where: { OR: [{ followerId: userId, followingId: person.id }, { followerId: person.id, followingId: userId }] },
    }),
    // A message request from them leaves Requests (and the unread count)
    prisma.conversationMember.updateMany({
      where: { userId, status: "request", conversation: { members: { some: { userId: person.id } } } },
      data: { clearedAt: new Date() },
    }),
  ]);
}

export async function unblock(userId: string, username: string) {
  const person = await findPerson(username);
  await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: person.id } });
}

// For Settings > Privacy, newest first
export async function listBlocked(userId: string) {
  const blocks = await prisma.block.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, blocked: { select: identitySelect } },
  });
  return blocks.map((b) => ({ ...identity(b.blocked), blockedAt: b.createdAt }));
}

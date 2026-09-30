import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { DELETED_USERNAME } from "../../lib/validation";
import { identity, identitySelect } from "../../lib/identity";
import { clearFollowRequest, notifyPerson } from "../notifications/notification.service";

// How the viewer relates to someone: not following, waiting for them to accept, or following
export type FollowStatus = "none" | "requested" | "following";

const asStatus = (follow: { status: string } | null): FollowStatus =>
  !follow ? "none" : follow.status === "accepted" ? "following" : "requested";

// Notifications are secondary: a problem creating one must never undo the action that caused it
async function safely(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (err) {
    console.error("Notification failed:", err);
  }
}

export async function findPerson(username: string) {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, NOT: { username: DELETED_USERNAME } },
    select: { id: true, isPrivate: true },
  });
  if (!user) throw new HttpError(404, "Profile not found");
  return user;
}

export async function followStatus(viewerId: string, targetId: string) {
  const follow = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } } });
  return asStatus(follow);
}

// A private profile's activity and lists are for its owner and the followers they've accepted
export async function canSeeActivity(viewerId: string, target: { id: string; isPrivate: boolean }) {
  return !target.isPrivate || target.id === viewerId || (await followStatus(viewerId, target.id)) === "following";
}

export async function follow(viewerId: string, username: string) {
  const target = await findPerson(username);
  if (target.id === viewerId) throw new HttpError(400, "You can't follow yourself");

  const key = { followerId_followingId: { followerId: viewerId, followingId: target.id } };
  const existing = await prisma.follow.findUnique({ where: key });
  if (existing) return asStatus(existing);

  const status = target.isPrivate ? "pending" : "accepted";
  // upsert rather than create, so two quick taps can't fail on the unique key
  const created = await prisma.follow.upsert({
    where: key,
    create: { followerId: viewerId, followingId: target.id, status },
    update: {},
  });
  await safely(() => notifyPerson(target.id, status === "pending" ? "follow_request" : "new_follower", viewerId));
  return asStatus(created);
}

// Unfollows, or withdraws a request that hasn't been answered yet
export async function unfollow(viewerId: string, username: string) {
  const target = await findPerson(username);
  await prisma.follow.deleteMany({ where: { followerId: viewerId, followingId: target.id } });
  await clearFollowRequest(target.id, viewerId);
  return "none" as const;
}

export async function listRequests(userId: string) {
  const requests = await prisma.follow.findMany({
    where: { followingId: userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { follower: { select: identitySelect } },
  });
  return requests.map((r) => ({ ...identity(r.follower), requestedAt: r.createdAt }));
}

export const pendingRequestCount = (userId: string) => prisma.follow.count({ where: { followingId: userId, status: "pending" } });

async function pendingFrom(userId: string, username: string) {
  const requester = await findPerson(username);
  const request = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: requester.id, followingId: userId } },
  });
  if (!request || request.status !== "pending") throw new HttpError(404, "Follow request not found");
  return { requester, request };
}

export async function acceptRequest(userId: string, username: string) {
  const { requester, request } = await pendingFrom(userId, username);
  await prisma.follow.update({ where: { id: request.id }, data: { status: "accepted" } });
  await clearFollowRequest(userId, requester.id);
  await safely(() => notifyPerson(requester.id, "follow_accepted", userId));
}

export async function declineRequest(userId: string, username: string) {
  const { requester, request } = await pendingFrom(userId, username);
  await prisma.follow.delete({ where: { id: request.id } });
  await clearFollowRequest(userId, requester.id);
}

// Stops someone following you (or cancels their request) without telling them
export async function removeFollower(userId: string, username: string) {
  const follower = await findPerson(username);
  await prisma.follow.deleteMany({ where: { followerId: follower.id, followingId: userId } });
  await clearFollowRequest(userId, follower.id);
}

// Making a profile public lets everyone waiting in, as there's nothing left to approve
export async function acceptAllRequests(userId: string) {
  const pending = await prisma.follow.findMany({ where: { followingId: userId, status: "pending" }, select: { followerId: true } });
  if (pending.length === 0) return;
  await prisma.follow.updateMany({ where: { followingId: userId, status: "pending" }, data: { status: "accepted" } });
  await prisma.notification.deleteMany({ where: { userId, kind: "follow_request" } });
  for (const p of pending) await safely(() => notifyPerson(p.followerId, "follow_accepted", userId));
}

export async function followCounts(userId: string) {
  const [followerCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId, status: "accepted" } }),
    prisma.follow.count({ where: { followerId: userId, status: "accepted" } }),
  ]);
  return { followerCount, followingCount };
}

const LIST_LIMIT = 200;

// Someone's followers, or the people they follow, each with the viewer's own follow status
export async function listPeople(viewerId: string, username: string, which: "followers" | "following") {
  const target = await findPerson(username);
  if (!(await canSeeActivity(viewerId, target))) throw new HttpError(403, "This profile is private");

  const follows = await prisma.follow.findMany({
    where: which === "followers" ? { followingId: target.id, status: "accepted" } : { followerId: target.id, status: "accepted" },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    include: {
      follower: { select: { id: true, ...identitySelect } },
      following: { select: { id: true, ...identitySelect } },
    },
  });
  const people = follows.map((f) => (which === "followers" ? f.follower : f.following));
  const mine = await prisma.follow.findMany({
    where: { followerId: viewerId, followingId: { in: people.map((p) => p.id) } },
    select: { followingId: true, status: true },
  });
  const statusOf = new Map(mine.map((m) => [m.followingId, asStatus(m)]));

  return people.map((p) => ({
    ...identity(p),
    isMe: p.id === viewerId,
    followStatus: statusOf.get(p.id) ?? ("none" as FollowStatus),
  }));
}

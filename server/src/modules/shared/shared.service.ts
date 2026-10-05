import { randomBytes } from "crypto";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { identity, identitySelect } from "../../lib/identity";
import { findPerson } from "../follows/follow.service";

export const MAX_MEMBERS = 50;

const memberInclude = { user: { select: { id: true, ...identitySelect } } } as const;

interface MemberRow {
  id: string;
  status: string;
  name: string | null;
  inviteToken: string | null;
  userId: string | null;
  user: { id: string; username: string; displayName: string | null; avatarUpdatedAt: Date | null } | null;
}

const nameOf = (m: MemberRow) => (m.user ? m.user.displayName || m.user.username : (m.name ?? ""));

// What other members see about someone: their public identity, never anything from their Tracker
function memberView(m: MemberRow, viewerId: string) {
  return {
    id: m.id,
    status: m.status,
    name: nameOf(m),
    person: m.user ? identity(m.user) : null,
    isMe: m.userId === viewerId,
    // A name-only member with a link waiting for their friend to open it
    linkShared: m.inviteToken !== null,
  };
}

// Notifications are secondary: a problem creating one must never undo the action that caused it
async function safely(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (err) {
    console.error("Notification failed:", err);
  }
}

// The viewer's own membership; anyone who isn't an active member is told the group doesn't exist
async function membership(userId: string, groupId: string) {
  const member = await prisma.groupMember.findFirst({ where: { groupId, userId, status: "active" }, include: { group: true } });
  if (!member) throw new HttpError(404, "Group not found");
  return member;
}

async function memberOf(groupId: string, memberId: string) {
  const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId }, include: memberInclude });
  if (!member) throw new HttpError(404, "Member not found");
  return member;
}

// A group with nobody left who can open it is deleted
async function deleteIfEmpty(groupId: string) {
  const users = await prisma.groupMember.count({ where: { groupId, status: "active", userId: { not: null } } });
  if (users === 0) await prisma.sharedGroup.delete({ where: { id: groupId } });
}

const clearInvite = (userId: string, inviterId: string | null, groupName: string) =>
  prisma.notification.deleteMany({ where: { userId, kind: "group_invite", title: groupName, ...(inviterId && { actorId: inviterId }) } });

export async function listGroups(userId: string) {
  const mine = await prisma.groupMember.findMany({
    where: { userId, status: { in: ["active", "invited"] } },
    orderBy: { createdAt: "desc" },
    include: {
      invitedBy: { select: identitySelect },
      group: { include: { members: { where: { status: "active" }, orderBy: { createdAt: "asc" }, include: memberInclude } } },
    },
  });
  return {
    groups: mine
      .filter((m) => m.status === "active")
      .map((m) => ({
        id: m.group.id,
        name: m.group.name,
        archived: m.group.archivedAt !== null,
        members: m.group.members.map((x) => memberView(x, userId)),
      })),
    invites: mine
      .filter((m) => m.status === "invited")
      .map((m) => ({
        id: m.id,
        groupName: m.group.name,
        memberCount: m.group.members.length,
        invitedBy: m.invitedBy ? identity(m.invitedBy) : null,
      })),
  };
}

export async function createGroup(userId: string, name: string) {
  const group = await prisma.sharedGroup.create({
    data: { name, members: { create: { userId, status: "active", joinedAt: new Date() } } },
  });
  return { id: group.id, name: group.name };
}

export async function getGroup(userId: string, groupId: string) {
  await membership(userId, groupId);
  const group = await prisma.sharedGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: { members: { where: { status: { in: ["active", "invited"] } }, orderBy: { createdAt: "asc" }, include: memberInclude } },
  });
  return {
    id: group.id,
    name: group.name,
    archived: group.archivedAt !== null,
    members: group.members.map((m) => memberView(m, userId)),
  };
}

export async function renameGroup(userId: string, groupId: string, name: string) {
  await membership(userId, groupId);
  await prisma.sharedGroup.update({ where: { id: groupId }, data: { name } });
}

export async function setArchived(userId: string, groupId: string, archived: boolean) {
  const { group } = await membership(userId, groupId);
  if (archived === (group.archivedAt !== null)) return;
  await prisma.sharedGroup.update({ where: { id: groupId }, data: { archivedAt: archived ? new Date() : null } });
}

async function checkRoom(groupId: string) {
  const count = await prisma.groupMember.count({ where: { groupId, status: { in: ["active", "invited"] } } });
  if (count >= MAX_MEMBERS) throw new HttpError(400, `A group can have up to ${MAX_MEMBERS} people`);
}

// Invites a Money Mitra user, who joins only once they accept
export async function inviteUser(userId: string, groupId: string, username: string) {
  const { group } = await membership(userId, groupId);
  const person = await findPerson(username);
  if (person.id === userId) throw new HttpError(400, "You're already in this group");
  await checkRoom(groupId);

  const existing = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: person.id } }, include: memberInclude });
  if (existing?.status === "active") throw new HttpError(400, `${nameOf(existing)} is already in this group`);
  if (existing?.status === "invited") throw new HttpError(400, `${nameOf(existing)} has already been invited`);

  // Someone who left can be invited back into their old spot, keeping their history
  const member = existing
    ? await prisma.groupMember.update({ where: { id: existing.id }, data: { status: "invited", invitedById: userId }, include: memberInclude })
    : await prisma.groupMember.create({ data: { groupId, userId: person.id, status: "invited", invitedById: userId }, include: memberInclude });
  await safely(() => prisma.notification.create({ data: { userId: person.id, kind: "group_invite", actorId: userId, title: group.name } }));
  return memberView(member, userId);
}

// Adds a friend who isn't on Money Mitra, by name only
export async function addNameOnly(userId: string, groupId: string, name: string) {
  await membership(userId, groupId);
  await checkRoom(groupId);
  const members = await prisma.groupMember.findMany({ where: { groupId, status: { in: ["active", "invited"] } }, include: memberInclude });
  if (members.some((m) => nameOf(m).toLowerCase() === name.toLowerCase())) {
    throw new HttpError(400, `There's already someone called ${name} in this group`);
  }
  const member = await prisma.groupMember.create({ data: { groupId, name, status: "active", invitedById: userId }, include: memberInclude });
  return memberView(member, userId);
}

// Cancels an invite or removes a name-only member. People who joined leave by themselves.
export async function removeMember(userId: string, groupId: string, memberId: string) {
  const { group } = await membership(userId, groupId);
  const member = await memberOf(groupId, memberId);
  if (member.userId && member.status === "active") throw new HttpError(400, "Only they can leave the group");
  if (member.status === "left") throw new HttpError(404, "Member not found");

  if (member.userId) {
    // Someone invited back after leaving keeps their spot for its history
    if (member.joinedAt) await prisma.groupMember.update({ where: { id: memberId }, data: { status: "left" } });
    else await prisma.groupMember.delete({ where: { id: memberId } });
    await clearInvite(member.userId, member.invitedById, group.name);
  } else {
    await prisma.groupMember.delete({ where: { id: memberId } });
  }
}

// A link the name-only member's friend can open to take over their spot
export async function shareLink(userId: string, groupId: string, memberId: string) {
  await membership(userId, groupId);
  const member = await memberOf(groupId, memberId);
  if (member.userId || member.status !== "active") throw new HttpError(400, "Links are only for people added by name");
  if (member.inviteToken) return member.inviteToken;
  const token = randomBytes(18).toString("base64url");
  await prisma.groupMember.update({ where: { id: memberId }, data: { inviteToken: token } });
  return token;
}

export async function leaveGroup(userId: string, groupId: string) {
  const member = await membership(userId, groupId);
  await prisma.groupMember.update({ where: { id: member.id }, data: { status: "left" } });
  await deleteIfEmpty(groupId);
}

async function pendingInvite(userId: string, memberId: string) {
  const member = await prisma.groupMember.findFirst({ where: { id: memberId, userId, status: "invited" }, include: { group: true } });
  if (!member) throw new HttpError(404, "Invite not found");
  return member;
}

export async function acceptInvite(userId: string, memberId: string) {
  const member = await pendingInvite(userId, memberId);
  await prisma.groupMember.update({ where: { id: memberId }, data: { status: "active", joinedAt: member.joinedAt ?? new Date() } });
  await clearInvite(userId, member.invitedById, member.group.name);
  return { groupId: member.groupId };
}

export async function declineInvite(userId: string, memberId: string) {
  const member = await pendingInvite(userId, memberId);
  if (member.joinedAt) await prisma.groupMember.update({ where: { id: memberId }, data: { status: "left" } });
  else await prisma.groupMember.delete({ where: { id: memberId } });
  await clearInvite(userId, member.invitedById, member.group.name);
}

async function spotFor(token: string) {
  const spot = await prisma.groupMember.findUnique({
    where: { inviteToken: token },
    include: { group: { include: { members: { where: { status: "active" }, select: { id: true } } } } },
  });
  if (!spot || spot.userId || spot.status !== "active") throw new HttpError(404, "This link has expired or was already used");
  return spot;
}

// What someone sees before joining through a link
export async function joinPreview(userId: string, token: string) {
  const spot = await spotFor(token);
  const mine = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: spot.groupId, userId } } });
  return {
    groupId: spot.groupId,
    groupName: spot.group.name,
    spotName: spot.name ?? "",
    memberCount: spot.group.members.length,
    alreadyMember: mine?.status === "active",
  };
}

// Takes over a name-only spot, so everything recorded for that name becomes the user's
export async function joinByLink(userId: string, token: string) {
  const spot = await spotFor(token);
  const mine = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: spot.groupId, userId } } });
  if (mine?.status === "active") throw new HttpError(400, "You're already in this group");
  if (mine?.joinedAt) throw new HttpError(400, "You've been in this group before. Ask a member to invite you back.");

  await prisma.$transaction(async (tx) => {
    // A pending invite to the same group is replaced by the spot
    if (mine) await tx.groupMember.delete({ where: { id: mine.id } });
    const taken = await tx.groupMember.updateMany({
      where: { id: spot.id, inviteToken: token, userId: null },
      data: { userId, name: null, inviteToken: null, joinedAt: new Date() },
    });
    if (taken.count === 0) throw new HttpError(404, "This link has expired or was already used");
  });
  if (mine) await clearInvite(userId, mine.invitedById, spot.group.name);
  return { groupId: spot.groupId };
}

// When an account is deleted, the person stays in their groups as a name, so the other members'
// history still adds up. Groups only they could open are deleted. Returns operations to run with
// the rest of the account deletion.
export async function releaseMemberships(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, displayName: true } });
  const active = await prisma.groupMember.findMany({ where: { userId, status: "active" }, select: { groupId: true } });
  const others = await prisma.groupMember.groupBy({
    by: ["groupId"],
    where: { groupId: { in: active.map((m) => m.groupId) }, status: "active", userId: { not: null, notIn: [userId] } },
  });
  const shared = new Set(others.map((o) => o.groupId));
  const alone = active.map((m) => m.groupId).filter((id) => !shared.has(id));

  return [
    prisma.sharedGroup.deleteMany({ where: { id: { in: alone } } }),
    prisma.groupMember.deleteMany({ where: { userId, status: "invited", joinedAt: null } }),
    prisma.groupMember.updateMany({ where: { userId, status: "invited" }, data: { status: "left" } }),
    prisma.groupMember.updateMany({ where: { userId }, data: { name: user.displayName || user.username } }),
  ];
}

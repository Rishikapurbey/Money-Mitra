import { Prisma } from "@prisma/client";
import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { DELETED_USERNAME } from "../../lib/validation";
import { identity, identitySelect } from "../../lib/identity";
import { escapeHtml } from "../../lib/html";
import { sendEmail } from "../../lib/email";
import { block, blockBetween, refuseIfBlocked } from "../blocks/block.service";

// One-to-one chat. Text only; nothing from anyone's Tracker can ever be attached.

export const MAX_MESSAGE = 2000;
const PAGE = 50;
const INBOX_LIMIT = 100;
const PREVIEW = 120;
export const DELETED_TEXT = "This message was deleted";

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

// Messages from someone you follow, or share a group with, go straight to your inbox. Anyone
// else's first message waits under Requests.
async function knows(recipientId: string, senderId: string) {
  const [follow, groupmate] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: recipientId, followingId: senderId, status: "accepted" }, select: { id: true } }),
    prisma.groupMember.findFirst({
      where: { userId: recipientId, status: "active", group: { members: { some: { userId: senderId, status: "active" } } } },
      select: { id: true },
    }),
  ]);
  return Boolean(follow || groupmate);
}

// The chat with this person, created (without any message) if there isn't one yet
export async function startConversation(userId: string, username: string) {
  const person = await prisma.user.findFirst({
    where: { username: { equals: username.replace(/^@/, ""), mode: "insensitive" }, NOT: { username: DELETED_USERNAME } },
    select: { id: true },
  });
  if (!person) throw new HttpError(404, "Profile not found");
  if (person.id === userId) throw new HttpError(400, "You can't message yourself");
  await refuseIfBlocked(userId, person.id, "You've blocked this account. Unblock them to message.", "You can't message this account");

  const key = pairKey(userId, person.id);
  const existing = await prisma.conversation.findUnique({ where: { pairKey: key }, select: { id: true } });
  if (existing) return existing.id;
  const theirStatus = (await knows(person.id, userId)) ? "accepted" : "request";
  try {
    const created = await prisma.conversation.create({
      data: { pairKey: key, members: { create: [{ userId, status: "accepted" }, { userId: person.id, status: theirStatus }] } },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // Both people opened the chat at the same moment: use the one that won
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return (await prisma.conversation.findUniqueOrThrow({ where: { pairKey: key }, select: { id: true } })).id;
    }
    throw err;
  }
}

async function load(userId: string, conversationId: string) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    include: { user: { select: { id: true, ...identitySelect } }, conversation: { select: { lastMessageAt: true } } },
  });
  const me = members.find((m) => m.userId === userId);
  if (!me) throw new HttpError(404, "Conversation not found");
  const other = members.find((m) => m.userId !== userId) ?? null;
  return { me, other };
}

type Other = { userId: string; status: string; lastReadAt: Date | null; user: { username: string; displayName: string | null; avatarUpdatedAt: Date | null } } | null;
const gone = (other: Other) => !other || other.user.username === DELETED_USERNAME;
// The other person as shown in the app; null once they've deleted their account ("Deleted user")
const personOf = (other: Other) => (gone(other) ? null : identity(other!.user));

// Why this person can't send a message right now, or null when they can. Someone who was blocked
// isn't told so: they just can't message the account.
async function cannotSend(userId: string, conversationId: string, other: Other, blocked: { byMe: boolean; byThem: boolean }) {
  if (gone(other)) return "This account has been deleted";
  if (blocked.byMe) return "You've blocked this account. Unblock them to send messages.";
  if (blocked.byThem) return "You can't message this account";
  if (other!.status === "request") {
    const sent = await prisma.message.count({ where: { conversationId, senderId: userId, deletedAt: null } });
    if (sent > 0) return "You can send more once they accept your message request";
  }
  return null;
}

const messageView = (m: { id: string; senderId: string; body: string; createdAt: Date; deletedAt: Date | null }, userId: string) => ({
  id: m.id,
  mine: m.senderId === userId,
  body: m.deletedAt ? "" : m.body,
  deleted: m.deletedAt !== null,
  createdAt: m.createdAt,
});

// A chat's latest messages (or older ones, before `before`), oldest first. Opening it reads it.
export async function getConversation(userId: string, conversationId: string, before?: Date) {
  const { me, other } = await load(userId, conversationId);
  const createdAt = { ...(me.clearedAt && { gt: me.clearedAt }), ...(before && { lt: before }) };
  const rows = await prisma.message.findMany({
    where: { conversationId, ...(Object.keys(createdAt).length > 0 && { createdAt }) },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
  });
  // A request isn't marked read, so its sender doesn't see "Seen" before it's accepted
  if (me.status === "accepted" && !before) {
    await prisma.conversationMember.update({ where: { id: me.id }, data: { lastReadAt: new Date() } });
  }
  const blocked = gone(other) ? { byMe: false, byThem: false } : await blockBetween(userId, other!.userId);
  const reason = await cannotSend(userId, conversationId, other, blocked);
  return {
    conversation: {
      id: conversationId,
      person: personOf(other),
      myStatus: me.status as "accepted" | "request",
      // They haven't accepted my message request yet
      waitingForThem: !gone(other) && other!.status === "request",
      // My messages up to here have been seen
      seenUpTo: !gone(other) && other!.status === "accepted" ? other!.lastReadAt : null,
      canSend: reason === null,
      cannotSendReason: reason,
      blockedByMe: blocked.byMe,
    },
    messages: rows.slice(0, PAGE).reverse().map((m) => messageView(m, userId)),
    hasMore: rows.length > PAGE,
  };
}

export async function sendMessage(userId: string, conversationId: string, body: string) {
  const text = body.trim();
  if (!text) throw new HttpError(400, "Write a message first");
  if (text.length > MAX_MESSAGE) throw new HttpError(400, `Messages can be up to ${MAX_MESSAGE.toLocaleString("en-IN")} characters`);
  const { me, other } = await load(userId, conversationId);
  const blocked = gone(other) ? { byMe: false, byThem: false } : await blockBetween(userId, other!.userId);
  const reason = await cannotSend(userId, conversationId, other, blocked);
  if (reason) throw new HttpError(403, reason);

  const now = new Date();
  const first = me.conversation.lastMessageAt === null;
  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId, senderId: userId, body: text, createdAt: now } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    // Replying to a request accepts it; sending also means everything before it has been read
    prisma.conversationMember.update({ where: { id: me.id }, data: { status: "accepted", lastReadAt: now } }),
  ]);
  // The bell tells someone about a new message request once; ordinary messages only show in the inbox count
  if (first && other!.status === "request") {
    await prisma.notification
      .create({ data: { userId: other!.userId, kind: "message_request", actorId: userId, title: "" } })
      .catch((err) => console.error("Notification failed:", err));
  }
  return messageView(message, userId);
}

// Unsend: like WhatsApp, a sender can delete their own message for both people at any time
export async function unsendMessage(userId: string, conversationId: string, messageId: string) {
  await load(userId, conversationId);
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId) throw new HttpError(404, "Message not found");
  if (message.senderId !== userId) throw new HttpError(403, "You can only delete your own messages");
  const updated = message.deletedAt ? message : await prisma.message.update({ where: { id: messageId }, data: { body: "", deletedAt: new Date() } });
  return messageView(updated, userId);
}

export async function acceptRequest(userId: string, conversationId: string) {
  const { me } = await load(userId, conversationId);
  await prisma.conversationMember.update({ where: { id: me.id }, data: { status: "accepted", lastReadAt: new Date() } });
}

// Removes the chat (or a request) from this person's inbox only. The other person keeps their copy,
// and a new message brings the chat back, starting from that message.
export async function deleteForMe(userId: string, conversationId: string) {
  const { me } = await load(userId, conversationId);
  const now = new Date();
  await prisma.conversationMember.update({ where: { id: me.id }, data: { clearedAt: now, lastReadAt: now } });
}

const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

// The inbox: chats (or message requests) with their newest message, most recent first
export async function listConversations(userId: string, tab: "chats" | "requests") {
  const rows = await prisma.conversationMember.findMany({
    where: { userId, status: tab === "requests" ? "request" : "accepted", conversation: { lastMessageAt: { not: null } } },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: INBOX_LIMIT,
    include: {
      conversation: {
        include: {
          members: { where: { userId: { not: userId } }, include: { user: { select: { id: true, ...identitySelect } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  return rows.flatMap((row) => {
    const last = row.conversation.messages[0];
    if (!last || (row.clearedAt && last.createdAt <= row.clearedAt)) return [];
    const other = row.conversation.members[0] ?? null;
    const readUpTo = later(row.lastReadAt, row.clearedAt);
    const text = last.deletedAt ? DELETED_TEXT : last.body.length > PREVIEW ? `${last.body.slice(0, PREVIEW - 1)}…` : last.body;
    return [
      {
        id: row.conversationId,
        person: personOf(other),
        lastMessage: { text, mine: last.senderId === userId, deleted: last.deletedAt !== null, createdAt: last.createdAt },
        unread: last.senderId !== userId && (!readUpTo || last.createdAt > readUpTo),
      },
    ];
  });
}

// For the badge on the messages icon: chats with unread messages, and new message requests
export async function unreadCounts(userId: string) {
  const rows = await prisma.conversationMember.findMany({
    where: { userId, conversation: { lastMessageAt: { not: null } } },
    select: {
      status: true,
      lastReadAt: true,
      clearedAt: true,
      conversation: { select: { messages: { where: { senderId: { not: userId } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } },
    },
  });
  let chats = 0;
  let requests = 0;
  for (const row of rows) {
    const latest = row.conversation.messages[0]?.createdAt;
    if (!latest) continue;
    if (row.status === "request") {
      if (!row.clearedAt || latest > row.clearedAt) requests += 1;
    } else {
      const readUpTo = later(row.lastReadAt, row.clearedAt);
      if (!readUpTo || latest > readUpTo) chats += 1;
    }
  }
  return { chats, requests };
}

// Everything a person can see in their chats, for "Download all your data"
export async function exportMessages(userId: string) {
  const rows = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: { where: { userId: { not: userId } }, include: { user: { select: { username: true } } } },
          messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, username: true } } } },
        },
      },
    },
  });
  return rows
    .map((row) => {
      const other = row.conversation.members[0];
      const withName = !other || other.user.username === DELETED_USERNAME ? "Deleted user" : other.user.username;
      const messages = row.conversation.messages
        .filter((m) => !row.clearedAt || m.createdAt > row.clearedAt)
        .map((m) => ({
          from: m.sender.id === userId ? "you" : withName,
          text: m.deletedAt ? DELETED_TEXT : m.body,
          sentAt: m.createdAt,
        }));
      return { with: withName, messages };
    })
    .filter((c) => c.messages.length > 0);
}

export const MESSAGE_REPORT_REASONS: Record<string, string> = {
  spam: "Spam",
  abusive: "Abusive or harassing",
  scam: "Scam or fraud",
  other: "Other",
};

// Reports someone else's message to the admin, keeping a copy of its text, and blocks the sender
// too when asked. The admin only ever sees reported messages, never the rest of a chat.
export async function reportMessage(userId: string, conversationId: string, messageId: string, reason: string, alsoBlock: boolean) {
  if (!MESSAGE_REPORT_REASONS[reason]) throw new HttpError(400, "Choose a reason");
  const { other } = await load(userId, conversationId);
  const message = await prisma.message.findUnique({ where: { id: messageId }, include: { sender: { select: { id: true, username: true } } } });
  if (!message || message.conversationId !== conversationId) throw new HttpError(404, "Message not found");
  if (message.senderId === userId) throw new HttpError(400, "You can't report your own message");
  if (message.deletedAt) throw new HttpError(400, "This message was deleted");

  const already = await prisma.messageReport.findUnique({ where: { messageId_reporterId: { messageId, reporterId: userId } } });
  if (!already) {
    const senderGone = message.sender.username === DELETED_USERNAME;
    await prisma.messageReport.create({
      data: { messageId, reporterId: userId, senderId: senderGone ? null : message.senderId, body: message.body, reason },
    });
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const label = MESSAGE_REPORT_REASONS[reason]!;
      const appUrl = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
      const from = senderGone ? "a deleted account" : `@${message.sender.username}`;
      const text = `A message from ${from} was reported as: ${label}\n\n${message.body}\n\nSee all reports: ${appUrl}/admin`;
      const html = `
  <div style="font-family: Arial, sans-serif; max-width: 520px; color: #0f1b2d;">
    <h2 style="margin-bottom: 8px;">A message was reported</h2>
    <p><strong>Reason:</strong> ${escapeHtml(label)}<br><strong>From:</strong> ${escapeHtml(from)}</p>
    <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f5f7fa; border-left: 3px solid #b4363f; white-space: pre-line;">${escapeHtml(message.body)}</blockquote>
    <p><a href="${appUrl}/admin">See all reports</a></p>
  </div>`;
      sendEmail({ to: adminEmail, subject: `Message report: ${label}`, text, html }).catch((err) => console.error("Message report email failed:", err));
    }
  }
  if (alsoBlock && !gone(other)) await block(userId, other!.user.username);
  return { reported: true, blocked: alsoBlock && !gone(other) };
}

// When someone deletes their account their messages stay, shown as "Deleted user" (like Discuss).
// Chats whose other person had already left have nobody left to read them, so they go entirely.
export async function releaseChats(userId: string, placeholderId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true, conversation: { select: { members: { select: { userId: true } } } } },
  });
  const empty = memberships.filter((m) => m.conversation.members.every((x) => x.userId === userId || x.userId === placeholderId));
  const kept = memberships.filter((m) => !empty.includes(m)).map((m) => m.conversationId);
  return [
    prisma.conversation.deleteMany({ where: { id: { in: empty.map((m) => m.conversationId) } } }),
    prisma.message.updateMany({ where: { senderId: userId }, data: { senderId: placeholderId } }),
    // Nobody can start a new chat with a deleted account, and the pair can never be matched again
    prisma.conversation.updateMany({ where: { id: { in: kept } }, data: { pairKey: null } }),
    prisma.conversationMember.updateMany({ where: { userId }, data: { userId: placeholderId } }),
  ];
}

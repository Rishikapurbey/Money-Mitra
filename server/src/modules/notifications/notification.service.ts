import prisma from "../../db/prisma";
import { monthBounds } from "../recaps/recap.service";
import { HttpError } from "../../lib/httpError";
import { sendEmail } from "../../lib/email";
import { escapeHtml } from "../../lib/html";
import { DELETED_USERNAME } from "../../lib/validation";
import { identity, identitySelect } from "../../lib/identity";

type Kind = "reply_to_question" | "reply_in_thread" | "helpful" | "post_hidden" | "reply_hidden" | "answer_accepted";
type PersonKind = "follow_request" | "new_follower" | "follow_accepted";

const EMAIL_GAP_MS = 60 * 60 * 1000;

// Records an event for a user. If the same kind of unread notification already exists for the
// same question (and reply), it is bumped instead, so a busy thread shows one line, not twenty.
async function upsertNotification(userId: string, kind: Kind, postId: string, title: string, replyId: string | null = null) {
  const existing = await prisma.notification.findFirst({
    where: { userId, kind, postId, replyId, readAt: null },
  });
  if (existing) {
    return prisma.notification.update({ where: { id: existing.id }, data: { count: { increment: 1 } } });
  }
  return prisma.notification.create({ data: { userId, kind, postId, title, replyId } });
}

const appUrl = () => (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");

function replyEmail(title: string, postId: string) {
  const link = `${appUrl()}/discuss/${postId}`;
  const settings = `${appUrl()}/settings/notifications`;
  const text = [
    "Someone replied to your question on Money Mitra:",
    `"${title}"`,
    "",
    `Read the reply: ${link}`,
    "",
    `You're getting this because you asked this question. Turn off reply emails in Settings: ${settings}`,
  ].join("\n");
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f1b2d;">
    <h2 style="margin-bottom: 8px;">You have a new reply</h2>
    <p>Someone replied to your question:</p>
    <p style="padding: 12px 16px; background: #f5f7fa; border-radius: 10px; font-weight: bold;">${escapeHtml(title)}</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background: #0f6f67; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: bold;">
        Read the reply
      </a>
    </p>
    <p style="color: #64748b; font-size: 13px;">You're getting this because you asked this question.
      <a href="${settings}" style="color: #64748b;">Turn off reply emails</a> in Settings.</p>
  </div>`;
  return { text, html };
}

// Emails the asker about a reply, at most once an hour per question, if they allow it
async function maybeEmailAsker(notificationId: string, userId: string, postId: string, title: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // Only to confirmed addresses, so a mistyped email never receives someone's activity
  if (!user || !user.emailReplies || !user.emailVerifiedAt || user.username === DELETED_USERNAME) return;
  const recent = await prisma.notification.findFirst({
    where: { userId, postId, kind: "reply_to_question", emailedAt: { gte: new Date(Date.now() - EMAIL_GAP_MS) } },
  });
  if (recent) return;
  await prisma.notification.update({ where: { id: notificationId }, data: { emailedAt: new Date() } });
  const { text, html } = replyEmail(title, postId);
  sendEmail({ to: user.email, subject: "New reply to your question on Money Mitra", text, html }).catch((err) =>
    console.error("Reply email failed:", err)
  );
}

// A new reply: tell the asker, and everyone else who has answered in the thread.
// The replier is never named, so anonymous replies stay anonymous.
export async function notifyReply(postId: string, replierId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { author: { select: { username: true } }, replies: { select: { authorId: true } } },
  });
  if (!post) return;

  if (post.authorId !== replierId && post.author.username !== DELETED_USERNAME) {
    const notification = await upsertNotification(post.authorId, "reply_to_question", postId, post.title);
    await maybeEmailAsker(notification.id, post.authorId, postId, post.title);
  }

  const others = new Set(post.replies.map((r) => r.authorId));
  others.delete(replierId);
  others.delete(post.authorId);
  const placeholder = await prisma.user.findUnique({ where: { username: DELETED_USERNAME }, select: { id: true } });
  if (placeholder) others.delete(placeholder.id);
  for (const userId of others) {
    await upsertNotification(userId, "reply_in_thread", postId, post.title);
  }
}

// Someone marked a reply helpful; repeated votes on the same reply are grouped
export async function notifyHelpful(replyId: string) {
  const reply = await prisma.reply.findUnique({ where: { id: replyId }, include: { post: { select: { id: true, title: true } } } });
  if (!reply) return;
  await upsertNotification(reply.authorId, "helpful", reply.post.id, reply.post.title, replyId);
}

// The asker marked someone's reply as the answer
export async function notifyAccepted(replyAuthorId: string, postId: string, title: string, replyId: string) {
  await upsertNotification(replyAuthorId, "answer_accepted", postId, title, replyId);
}

// A question or reply crossed the report threshold and is now hidden
export async function notifyHidden(postId: string, replyId: string | null) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return;
  if (replyId) {
    const reply = await prisma.reply.findUnique({ where: { id: replyId } });
    if (reply) await upsertNotification(reply.authorId, "reply_hidden", postId, post.title, replyId);
  } else {
    await upsertNotification(post.authorId, "post_hidden", postId, post.title);
  }
}

// A follow event from one person to another. An unread one from the same person isn't repeated,
// so following and unfollowing over and over doesn't flood the bell.
export async function notifyPerson(userId: string, kind: PersonKind, actorId: string) {
  const existing = await prisma.notification.findFirst({ where: { userId, kind, actorId, readAt: null } });
  if (existing) return;
  await prisma.notification.create({ data: { userId, kind, actorId, title: "" } });
}

// A request was answered or withdrawn, so it no longer needs the owner's attention
export const clearFollowRequest = (ownerId: string, requesterId: string) =>
  prisma.notification.deleteMany({ where: { userId: ownerId, kind: "follow_request", actorId: requesterId } });

// Someone asked a question under their name: tell the people who follow them.
// Never called for anonymous questions, which would reveal who asked.
export async function notifyFollowersOfPost(authorId: string, postId: string, title: string) {
  const followers = await prisma.follow.findMany({ where: { followingId: authorId, status: "accepted" }, select: { followerId: true } });
  if (followers.length === 0) return;
  await prisma.notification.createMany({
    data: followers.map((f) => ({ userId: f.followerId, kind: "followed_post", actorId: authorId, postId, title })),
  });
}

function message(kind: string, count: number, actor: string) {
  switch (kind) {
    case "follow_request":
      return `${actor} asked to follow you`;
    case "new_follower":
      return `${actor} started following you`;
    case "follow_accepted":
      return `${actor} accepted your follow request`;
    case "followed_post":
      return `${actor} asked a question`;
    case "reply_to_question":
      return count === 1 ? "New reply to your question" : `${count} new replies to your question`;
    case "reply_in_thread":
      return count === 1 ? "New reply in a discussion you joined" : `${count} new replies in a discussion you joined`;
    case "helpful":
      return count === 1 ? "Someone found your answer helpful" : `${count} people found your answer helpful`;
    case "post_hidden":
      return "Your question was hidden after reports from the community";
    case "reply_hidden":
      return "Your reply was hidden after reports from the community";
    case "answer_accepted":
      return "Your reply was marked as the answer";
    default:
      return "New activity in Discuss";
  }
}

const isBudget = (kind: string) => kind === "budget_near" || kind === "budget_over";

export async function listNotifications(userId: string) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { actor: { select: identitySelect } },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    unread,
    notifications: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      // A budget alert's whole message is stored as its title; a recap's title is its month
      message: isBudget(n.kind)
        ? n.title
        : n.kind === "recap_ready"
          ? `Your ${monthBounds(n.title, 0).shortName} recap is ready`
          : n.kind === "year_ready"
            ? `Your ${n.title} in money is ready`
            : message(n.kind, n.count, n.actor ? n.actor.displayName || n.actor.username : "Someone"),
      title: isBudget(n.kind) || n.kind === "recap_ready" || n.kind === "year_ready" ? "" : n.title,
      month: n.kind === "recap_ready" ? n.title : null,
      year: n.kind === "year_ready" ? n.title : null,
      postId: n.postId,
      actor: n.actor ? identity(n.actor) : null,
      read: n.readAt !== null,
      updatedAt: n.updatedAt,
    })),
  };
}

export const unreadCount = (userId: string) => prisma.notification.count({ where: { userId, readAt: null } });

export async function markRead(userId: string, id: string) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== userId) throw new HttpError(404, "Notification not found");
  await prisma.notification.update({ where: { id }, data: { readAt: n.readAt ?? new Date() } });
}

// Opening a discussion marks everything about it as read
export const markPostRead = (userId: string, postId: string) =>
  prisma.notification.updateMany({ where: { userId, postId, readAt: null }, data: { readAt: new Date() } });

export const markAllRead = (userId: string) =>
  prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });

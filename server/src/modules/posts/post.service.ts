import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { DELETED_USERNAME } from "../../lib/validation";
import { sendEmail } from "../../lib/email";
import { escapeHtml } from "../../lib/html";
import { notifyHelpful, notifyHidden, notifyReply } from "../notifications/notification.service";
import { identity, identitySelect } from "../../lib/identity";

// Notifications are secondary: a problem sending one must never undo the action that caused it
async function safely(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (err) {
    console.error("Notification failed:", err);
  }
}

export const TOPICS = ["Budgeting", "Saving", "Investing", "Loans & Credit", "Tax", "Other"];

export const REPORT_REASONS: Record<string, string> = {
  spam: "Spam",
  abusive: "Abusive or hateful",
  misleading: "Misleading money advice",
  other: "Other",
};

// Questions and replies with this many reports are hidden from everyone
export const HIDE_AFTER_REPORTS = 3;

interface Authored {
  isAnonymous: boolean;
  authorId: string;
  author: { username: string; displayName: string | null; avatarUpdatedAt: Date | null };
}

// Never expose who wrote an anonymous post or reply, only whether it's the viewer's own.
// `profile` (name, photo, link) is only given for authors posting under their own name.
function present<T extends Authored>(item: T, viewerId: string) {
  const { authorId, author, ...rest } = item;
  const deleted = author.username === DELETED_USERNAME;
  return {
    ...rest,
    author: item.isAnonymous ? null : deleted ? "Deleted user" : author.username,
    profile: item.isAnonymous || deleted ? null : identity(author),
    isMine: authorId === viewerId,
  };
}

// Hidden content keeps its place in the thread but shows none of what was written or who wrote it
function hideIfReported<T extends { body: string; author: string | null }>(item: T, reportCount: number) {
  const hidden = reportCount >= HIDE_AFTER_REPORTS;
  return hidden ? { ...item, body: "", author: null, profile: null, hidden } : { ...item, hidden };
}

const authorSelect = { author: { select: identitySelect } };

export async function listPosts(viewerId: string, options: { topic?: string | undefined; unanswered?: boolean } = {}) {
  const posts = await prisma.post.findMany({
    where: {
      ...(options.topic && { topic: options.topic }),
      ...(options.unanswered && { replies: { none: {} } }),
    },
    orderBy: { createdAt: "desc" },
    include: { ...authorSelect, _count: { select: { replies: true, reports: true } } },
  });
  // Hidden questions are left out of the list entirely
  return posts
    .filter((p) => p._count.reports < HIDE_AFTER_REPORTS)
    .map(({ _count, ...post }) => ({ ...present(post, viewerId), replyCount: _count.replies, hidden: false }));
}

export async function getPost(viewerId: string, id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      ...authorSelect,
      _count: { select: { reports: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          ...authorSelect,
          _count: { select: { votes: true, reports: true } },
          votes: { where: { userId: viewerId }, select: { id: true } },
        },
      },
    },
  });
  if (!post) return null;

  const { replies, _count, ...rest } = post;
  const presentedReplies = replies
    .map(({ _count: counts, votes, ...reply }) => ({
      ...hideIfReported(present(reply, viewerId), counts.reports),
      helpfulCount: counts.votes,
      votedByMe: votes.length > 0,
    }))
    // Most helpful first; ties keep the order they were posted in
    .sort((a, b) => b.helpfulCount - a.helpfulCount || a.createdAt.getTime() - b.createdAt.getTime());

  const hiddenPost = hideIfReported(present(rest, viewerId), _count.reports);
  return { ...hiddenPost, title: hiddenPost.hidden ? "" : rest.title, replies: presentedReplies };
}

export async function createPost(
  authorId: string,
  data: { title: string; body: string; topic: string; isAnonymous: boolean }
) {
  const post = await prisma.post.create({ data: { ...data, authorId }, include: authorSelect });
  return { ...present(post, authorId), replyCount: 0, hidden: false };
}

export async function deletePost(userId: string, id: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.authorId !== userId) throw new HttpError(404, "Post not found");
  await prisma.post.delete({ where: { id } });
}

export async function createReply(authorId: string, postId: string, data: { body: string; isAnonymous: boolean }) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  const reply = await prisma.reply.create({ data: { ...data, postId, authorId }, include: authorSelect });
  await safely(() => notifyReply(postId, authorId));
  return { ...present(reply, authorId), hidden: false, helpfulCount: 0, votedByMe: false };
}

export async function deleteReply(userId: string, postId: string, id: string) {
  const reply = await prisma.reply.findUnique({ where: { id } });
  if (!reply || reply.postId !== postId || reply.authorId !== userId) throw new HttpError(404, "Reply not found");
  await prisma.reply.delete({ where: { id } });
}

// Toggles the viewer's "helpful" vote on a reply
export async function toggleHelpful(userId: string, postId: string, replyId: string) {
  const reply = await prisma.reply.findUnique({
    where: { id: replyId },
    include: { _count: { select: { reports: true } } },
  });
  if (!reply || reply.postId !== postId || reply._count.reports >= HIDE_AFTER_REPORTS) {
    throw new HttpError(404, "Reply not found");
  }
  if (reply.authorId === userId) throw new HttpError(400, "You can't mark your own reply as helpful");

  const existing = await prisma.replyVote.findUnique({ where: { userId_replyId: { userId, replyId } } });
  if (existing) await prisma.replyVote.delete({ where: { id: existing.id } });
  else {
    await prisma.replyVote.create({ data: { userId, replyId } });
    await safely(() => notifyHelpful(replyId));
  }

  const helpfulCount = await prisma.replyVote.count({ where: { replyId } });
  return { helpfulCount, votedByMe: !existing };
}

function reportEmail(what: string, reason: string, count: number, content: string, link: string) {
  const hidden = count >= HIDE_AFTER_REPORTS;
  const status = hidden
    ? `It now has ${count} reports and has been hidden automatically.`
    : `It has ${count} report${count === 1 ? "" : "s"}. It will be hidden automatically at ${HIDE_AFTER_REPORTS}.`;
  const text = [`A ${what} in Discuss was reported as: ${reason}.`, status, "", "Content:", content, "", link].join("\n");
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 520px; color: #0f1b2d;">
    <h2 style="margin-bottom: 8px;">A ${what} was reported</h2>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p>${status}</p>
    <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f5f7fa; border-left: 3px solid #b4363f; white-space: pre-line;">${escapeHtml(content)}</blockquote>
    <p><a href="${link}">Open the discussion</a></p>
  </div>`;
  return { text, html };
}

// Records a report and emails the admin. The count decides whether the item is now hidden.
export async function report(reporterId: string, postId: string, replyId: string | null, reasonKey: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  const reply = replyId ? await prisma.reply.findUnique({ where: { id: replyId } }) : null;
  if (replyId && (!reply || reply.postId !== postId)) throw new HttpError(404, "Reply not found");

  const target = reply ?? post;
  if (target.authorId === reporterId) throw new HttpError(400, "You can't report your own post");

  const already = await prisma.report.findFirst({
    where: { reporterId, ...(reply ? { replyId: reply.id } : { postId, replyId: null }) },
  });
  if (already) throw new HttpError(409, "You've already reported this. Thank you.");

  await prisma.report.create({
    data: { reporterId, reason: reasonKey, ...(reply ? { replyId: reply.id } : { postId }) },
  });
  const count = await prisma.report.count({ where: reply ? { replyId: reply.id } : { postId, replyId: null } });

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const appUrl = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
    const content = reply ? reply.body : `${post.title}\n\n${post.body}`;
    const reason = REPORT_REASONS[reasonKey] ?? "Other";
    const { text, html } = reportEmail(reply ? "reply" : "question", reason, count, content, `${appUrl}/discuss/${postId}`);
    sendEmail({ to: adminEmail, subject: `Discuss report: ${reason}`, text, html }).catch((err) =>
      console.error("Report email failed:", err)
    );
  }

  // Tell the author once, at the moment it becomes hidden
  if (count === HIDE_AFTER_REPORTS) await safely(() => notifyHidden(postId, reply?.id ?? null));

  return { hidden: count >= HIDE_AFTER_REPORTS };
}

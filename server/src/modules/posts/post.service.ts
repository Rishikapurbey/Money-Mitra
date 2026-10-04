import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { DELETED_USERNAME } from "../../lib/validation";
import { sendEmail } from "../../lib/email";
import { escapeHtml } from "../../lib/html";
import { notifyAccepted, notifyFollowersOfPost, notifyHelpful, notifyHidden, notifyReply } from "../notifications/notification.service";
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

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

// Questions with a reply matching the search. Replies hidden after reports never count, so a
// search can't be used to find out what a hidden reply said.
async function postsWithMatchingReply(q: string) {
  const replies = await prisma.reply.findMany({
    where: { body: contains(q) },
    select: { postId: true, _count: { select: { reports: true } } },
  });
  return [...new Set(replies.filter((r) => r._count.reports < HIDE_AFTER_REPORTS).map((r) => r.postId))];
}

export async function listPosts(
  viewerId: string,
  options: { topic?: string | undefined; unanswered?: boolean; following?: boolean; q?: string | undefined } = {}
) {
  const q = options.q?.trim();
  const replyMatches = q ? await postsWithMatchingReply(q) : [];
  const posts = await prisma.post.findMany({
    where: {
      ...(options.topic && { topic: options.topic }),
      ...(options.unanswered && { replies: { none: {} } }),
      // Questions asked under their own name by people the viewer follows (anonymous ones never show)
      ...(options.following && {
        isAnonymous: false,
        author: { followers: { some: { followerId: viewerId, status: "accepted" } } },
      }),
      ...(q && { OR: [{ title: contains(q) }, { body: contains(q) }, { id: { in: replyMatches } }] }),
    },
    orderBy: { createdAt: "desc" },
    include: { ...authorSelect, _count: { select: { replies: true, reports: true } } },
  });
  // Hidden questions are left out of the list entirely
  return posts
    .filter((p) => p._count.reports < HIDE_AFTER_REPORTS)
    .map(({ _count, acceptedReplyId, ...post }) => ({
      ...present(post, viewerId),
      replyCount: _count.replies,
      answered: acceptedReplyId !== null,
      hidden: false,
    }));
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

  const { replies, _count, acceptedReplyId, ...rest } = post;
  const presentedReplies = replies
    .map(({ _count: counts, votes, ...reply }) => {
      const presented = hideIfReported(present(reply, viewerId), counts.reports);
      return {
        ...presented,
        helpfulCount: counts.votes,
        votedByMe: votes.length > 0,
        // A hidden reply never shows as the answer
        accepted: reply.id === acceptedReplyId && !presented.hidden,
      };
    })
    // The accepted answer first, then the most helpful; ties keep the order they were posted in
    .sort(
      (a, b) =>
        Number(b.accepted) - Number(a.accepted) ||
        b.helpfulCount - a.helpfulCount ||
        a.createdAt.getTime() - b.createdAt.getTime()
    );

  const hiddenPost = hideIfReported(present(rest, viewerId), _count.reports);
  const answered = presentedReplies.some((r) => r.accepted);
  return { ...hiddenPost, title: hiddenPost.hidden ? "" : rest.title, answered, replies: presentedReplies };
}

// The asker marks one reply as the answer, or clears it with null. Works on anonymous questions too,
// since only the asker can do it and nothing about them is shown.
export async function acceptAnswer(userId: string, postId: string, replyId: string | null) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== userId) throw new HttpError(404, "Post not found");
  if (replyId === null) {
    await prisma.post.update({ where: { id: postId }, data: { acceptedReplyId: null } });
    return { acceptedReplyId: null };
  }
  const reply = await prisma.reply.findUnique({ where: { id: replyId }, include: { _count: { select: { reports: true } } } });
  if (!reply || reply.postId !== postId || reply._count.reports >= HIDE_AFTER_REPORTS) {
    throw new HttpError(404, "Reply not found");
  }
  await prisma.post.update({ where: { id: postId }, data: { acceptedReplyId: replyId } });
  if (post.acceptedReplyId !== replyId && reply.authorId !== userId) {
    await safely(() => notifyAccepted(reply.authorId, postId, post.title, replyId));
  }
  return { acceptedReplyId: replyId };
}

// Everything the user has posted, anonymous or not, since only they see this
export async function getActivity(userId: string) {
  const [posts, replies, questionCount, replyCount, helpfulCount, acceptedCount] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        topic: true,
        isAnonymous: true,
        createdAt: true,
        acceptedReplyId: true,
        _count: { select: { replies: true, reports: true } },
      },
    }),
    prisma.reply.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        body: true,
        isAnonymous: true,
        createdAt: true,
        post: { select: { id: true, title: true, _count: { select: { reports: true } } } },
        acceptedFor: { select: { id: true } },
        _count: { select: { votes: true, reports: true } },
      },
    }),
    prisma.post.count({ where: { authorId: userId } }),
    prisma.reply.count({ where: { authorId: userId } }),
    prisma.replyVote.count({ where: { reply: { authorId: userId } } }),
    prisma.post.count({ where: { acceptedReply: { authorId: userId } } }),
  ]);
  return {
    totals: { questions: questionCount, replies: replyCount, helpful: helpfulCount, accepted: acceptedCount },
    questions: posts.map((p) => ({
      id: p.id,
      title: p.title,
      topic: p.topic,
      isAnonymous: p.isAnonymous,
      createdAt: p.createdAt,
      replyCount: p._count.replies,
      answered: p.acceptedReplyId !== null,
      hidden: p._count.reports >= HIDE_AFTER_REPORTS,
    })),
    replies: replies.map((r) => ({
      id: r.id,
      body: r.body.slice(0, 200),
      isAnonymous: r.isAnonymous,
      createdAt: r.createdAt,
      postId: r.post.id,
      // A question hidden after reports keeps its title out of view, as everywhere else
      postTitle: r.post._count.reports >= HIDE_AFTER_REPORTS ? "" : r.post.title,
      helpfulCount: r._count.votes,
      accepted: r.acceptedFor !== null,
      hidden: r._count.reports >= HIDE_AFTER_REPORTS,
    })),
  };
}

export async function createPost(
  authorId: string,
  data: { title: string; body: string; topic: string; isAnonymous: boolean }
) {
  const post = await prisma.post.create({ data: { ...data, authorId }, include: authorSelect });
  if (!data.isAnonymous) await safely(() => notifyFollowersOfPost(authorId, post.id, post.title));
  const { acceptedReplyId: _, ...created } = post;
  return { ...present(created, authorId), replyCount: 0, answered: false, hidden: false };
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
  return { ...present(reply, authorId), hidden: false, helpfulCount: 0, votedByMe: false, accepted: false };
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

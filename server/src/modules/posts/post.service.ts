import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { DELETED_USERNAME } from "../../lib/validation";

export const TOPICS = ["Budgeting", "Saving", "Investing", "Loans & Credit", "Tax", "Other"];

interface Authored {
  isAnonymous: boolean;
  authorId: string;
  author: { username: string };
}

// Never expose who wrote an anonymous post or reply, only whether it's the viewer's own
function present<T extends Authored>(item: T, viewerId: string) {
  const { authorId, author, ...rest } = item;
  return {
    ...rest,
    author: item.isAnonymous ? null : author.username === DELETED_USERNAME ? "Deleted user" : author.username,
    isMine: authorId === viewerId,
  };
}

const authorSelect = { author: { select: { username: true } } };

export async function listPosts(viewerId: string, topic?: string) {
  const posts = await prisma.post.findMany({
    where: topic ? { topic } : {},
    orderBy: { createdAt: "desc" },
    include: { ...authorSelect, _count: { select: { replies: true } } },
  });
  return posts.map(({ _count, ...post }) => ({ ...present(post, viewerId), replyCount: _count.replies }));
}

export async function getPost(viewerId: string, id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { ...authorSelect, replies: { orderBy: { createdAt: "asc" }, include: authorSelect } },
  });
  if (!post) return null;
  const { replies, ...rest } = post;
  return { ...present(rest, viewerId), replies: replies.map((r) => present(r, viewerId)) };
}

export async function createPost(
  authorId: string,
  data: { title: string; body: string; topic: string; isAnonymous: boolean }
) {
  const post = await prisma.post.create({ data: { ...data, authorId }, include: authorSelect });
  return { ...present(post, authorId), replyCount: 0 };
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
  return present(reply, authorId);
}

export async function deleteReply(userId: string, postId: string, id: string) {
  const reply = await prisma.reply.findUnique({ where: { id } });
  if (!reply || reply.postId !== postId || reply.authorId !== userId) throw new HttpError(404, "Reply not found");
  await prisma.reply.delete({ where: { id } });
}

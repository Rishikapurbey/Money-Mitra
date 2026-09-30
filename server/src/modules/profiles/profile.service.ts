import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { DELETED_USERNAME } from "../../lib/validation";
import { HIDE_AFTER_REPORTS } from "../posts/post.service";
import { avatarUrl, identity, identitySelect } from "../../lib/identity";

const RECENT = 20;

// A person's public profile. Only posts and replies made under their name count; anonymous ones are
// never shown or counted, and a private profile's activity is visible only to its owner.
export async function getProfile(viewerId: string, username: string) {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, NOT: { username: DELETED_USERNAME } },
    select: { id: true, ...identitySelect, bio: true, isPrivate: true, createdAt: true },
  });
  if (!user) throw new HttpError(404, "Profile not found");

  const isMe = user.id === viewerId;
  const profile = { ...identity(user), bio: user.bio, joinedAt: user.createdAt, isPrivate: user.isPrivate, isMe };
  if (user.isPrivate && !isMe) return { ...profile, activity: null };

  const [posts, replies] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: user.id, isAnonymous: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, topic: true, createdAt: true, _count: { select: { replies: true, reports: true } } },
    }),
    prisma.reply.findMany({
      where: { authorId: user.id, isAnonymous: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        body: true,
        createdAt: true,
        post: { select: { id: true, title: true, _count: { select: { reports: true } } } },
        _count: { select: { votes: true, reports: true } },
      },
    }),
  ]);

  // Content hidden after community reports doesn't appear or count
  const questions = posts.filter((p) => p._count.reports < HIDE_AFTER_REPORTS);
  const answers = replies.filter((r) => r._count.reports < HIDE_AFTER_REPORTS && r.post._count.reports < HIDE_AFTER_REPORTS);

  return {
    ...profile,
    activity: {
      questionCount: questions.length,
      replyCount: answers.length,
      helpfulCount: answers.reduce((sum, r) => sum + r._count.votes, 0),
      questions: questions.slice(0, RECENT).map((p) => ({
        id: p.id,
        title: p.title,
        topic: p.topic,
        createdAt: p.createdAt,
        replyCount: p._count.replies,
      })),
      replies: answers.slice(0, RECENT).map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt,
        helpfulCount: r._count.votes,
        postId: r.post.id,
        postTitle: r.post.title,
      })),
    },
  };
}

export async function getAvatar(username: string) {
  const user = await prisma.user.findUnique({ where: { username }, select: { avatar: true } });
  return user?.avatar ?? null;
}

const IMAGE_TYPES: Record<string, (bytes: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
};

// The app shrinks photos to 256px before upload (a few tens of KB); this is a generous ceiling
export const MAX_PHOTO_BYTES = 70 * 1024;

// Accepts a data URL ("data:image/jpeg;base64,...") and checks the bytes really are that kind of image
export function parsePhoto(dataUrl: string) {
  const [, mimeType = "", base64 = ""] = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) ?? [];
  const check = IMAGE_TYPES[mimeType];
  if (!check) throw new HttpError(400, "Please choose a JPEG, PNG or WebP photo");
  const data = Buffer.from(base64, "base64");
  if (data.length === 0 || !check(data)) throw new HttpError(400, "That file doesn't look like a photo");
  if (data.length > MAX_PHOTO_BYTES) throw new HttpError(400, "That photo is too large. Please try a smaller one.");
  return { mimeType, data };
}

export async function setPhoto(userId: string, photo: { mimeType: string; data: Buffer }) {
  const [, user] = await prisma.$transaction([
    prisma.avatar.upsert({ where: { userId }, create: { userId, ...photo }, update: photo }),
    prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: new Date() }, select: identitySelect }),
  ]);
  return avatarUrl(user);
}

export async function removePhoto(userId: string) {
  await prisma.$transaction([
    prisma.avatar.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: null } }),
  ]);
}

// Names that could pass for the app, staff or an anonymous or deleted author
const RESERVED_NAMES = ["anonymous", "deleteduser", "moneymitra", "admin", "administrator", "moderator", "support", "you"];

export function displayNameProblem(name: string): string | null {
  if (name.length > 40) return "Your name can be up to 40 characters";
  // Control characters (including new lines) and invisible formatting characters
  if (/[\p{Cc}\p{Cf}]/u.test(name)) return "Your name can't contain special invisible characters";
  if (RESERVED_NAMES.includes(name.toLowerCase().replace(/[^a-z]/g, ""))) return "That name isn't available";
  return null;
}

export const MAX_BIO = 160;

export async function updateProfile(userId: string, data: { displayName: string | null; bio: string | null }) {
  return prisma.user.update({ where: { id: userId }, data, select: { displayName: true, bio: true } });
}

export async function updatePrivacy(userId: string, data: { isPrivate?: boolean; anonymousByDefault?: boolean }) {
  return prisma.user.update({ where: { id: userId }, data, select: { isPrivate: true, anonymousByDefault: true } });
}

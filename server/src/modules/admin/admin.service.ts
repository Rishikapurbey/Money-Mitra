import prisma from "../../db/prisma";
import { avatarUrl } from "../../lib/identity";
import { HIDE_AFTER_REPORTS, REPORT_REASONS } from "../posts/post.service";

// The admin page shows counts of people and their identity, never anything from anyone's
// Tracker: no amounts, balances or totals, not even added up across everyone.

const DAY = 24 * 60 * 60 * 1000;
// Weeks run Monday to Sunday in India time, whatever time zone the server is in
const IST_OFFSET = (5 * 60 + 30) * 60 * 1000;
const SIGNUP_WEEKS = 12;
const USER_LIST_LIMIT = 200;
const EXCERPT_LENGTH = 160;

// The admin is whoever is logged in with ADMIN_EMAIL, once they've confirmed they own it
export async function isAdmin(userId: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
  return Boolean(user?.emailVerifiedAt && user.email.trim().toLowerCase() === adminEmail);
}

// Monday 00:00 India time of the week holding `date`, as a real instant
function weekStart(date: Date) {
  const local = new Date(date.getTime() + IST_OFFSET);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday);
  return new Date(monday - IST_OFFSET);
}

const weekKey = (start: Date) => new Date(start.getTime() + IST_OFFSET).toISOString().slice(0, 10);

export function signupsByWeek(createdAt: Date[], now: Date, weeks = SIGNUP_WEEKS) {
  const thisWeek = weekStart(now);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(thisWeek.getTime() - (weeks - 1 - i) * 7 * DAY);
    return { week: weekKey(start), signups: 0 };
  });
  const byWeek = new Map(buckets.map((b) => [b.week, b]));
  for (const date of createdAt) {
    const bucket = byWeek.get(weekKey(weekStart(date)));
    if (bucket) bucket.signups += 1;
  }
  return buckets;
}

const excerpt = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : flat;
};

async function reportedItems() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      reason: true,
      createdAt: true,
      postId: true,
      replyId: true,
      post: { select: { id: true, title: true, body: true } },
      reply: { select: { id: true, body: true, postId: true, post: { select: { title: true } } } },
    },
  });

  type Item = {
    kind: "question" | "reply";
    id: string;
    postId: string;
    title: string;
    excerpt: string;
    reports: number;
    reasons: { reason: string; count: number }[];
    hidden: boolean;
    lastReportedAt: Date;
  };
  const items = new Map<string, Item>();
  for (const r of reports) {
    const key = r.replyId ? `reply:${r.replyId}` : `post:${r.postId}`;
    let item = items.get(key);
    if (!item) {
      if (r.reply) {
        item = { kind: "reply", id: r.reply.id, postId: r.reply.postId, title: r.reply.post.title, excerpt: excerpt(r.reply.body), reports: 0, reasons: [], hidden: false, lastReportedAt: r.createdAt };
      } else if (r.post) {
        item = { kind: "question", id: r.post.id, postId: r.post.id, title: r.post.title, excerpt: excerpt(r.post.body), reports: 0, reasons: [], hidden: false, lastReportedAt: r.createdAt };
      } else {
        continue;
      }
      items.set(key, item);
    }
    item.reports += 1;
    const label = REPORT_REASONS[r.reason] ?? "Other";
    const reason = item.reasons.find((x) => x.reason === label);
    if (reason) reason.count += 1;
    else item.reasons.push({ reason: label, count: 1 });
  }
  return [...items.values()].map((item) => ({
    ...item,
    reasons: item.reasons.sort((a, b) => b.count - a.count),
    hidden: item.reports >= HIDE_AFTER_REPORTS,
  }));
}

export async function adminOverview(now = new Date()) {
  const since = (days: number) => new Date(now.getTime() - days * DAY);
  const usersWith = (where: object) => prisma.user.count({ where });

  const [
    total,
    verified,
    newThisWeek,
    newThisMonth,
    activeToday,
    activeWeek,
    activeMonth,
    recentSignups,
    tracker,
    budgets,
    goals,
    netWorth,
    transfers,
    recurring,
    imports,
    shared,
    asked,
    replied,
    following,
    questions,
    replies,
    questionsThisWeek,
    repliesThisWeek,
    reports,
    people,
  ] = await Promise.all([
    prisma.user.count(),
    usersWith({ emailVerifiedAt: { not: null } }),
    usersWith({ createdAt: { gte: since(7) } }),
    usersWith({ createdAt: { gte: since(30) } }),
    usersWith({ lastActiveAt: { gte: since(1) } }),
    usersWith({ lastActiveAt: { gte: since(7) } }),
    usersWith({ lastActiveAt: { gte: since(30) } }),
    prisma.user.findMany({ where: { createdAt: { gte: since(SIGNUP_WEEKS * 7 + 7) } }, select: { createdAt: true } }),
    usersWith({ transactions: { some: {} } }),
    usersWith({ budgets: { some: {} } }),
    usersWith({ goals: { some: {} } }),
    usersWith({ netWorthItems: { some: {} } }),
    usersWith({ transfers: { some: {} } }),
    usersWith({ recurring: { some: {} } }),
    usersWith({ imports: { some: {} } }),
    usersWith({ groupMemberships: { some: { status: "active" } } }),
    usersWith({ posts: { some: {} } }),
    usersWith({ replies: { some: {} } }),
    usersWith({ following: { some: { status: "accepted" } } }),
    prisma.post.count(),
    prisma.reply.count(),
    prisma.post.count({ where: { createdAt: { gte: since(7) } } }),
    prisma.reply.count({ where: { createdAt: { gte: since(7) } } }),
    reportedItems(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: USER_LIST_LIMIT,
      select: { username: true, displayName: true, avatarUpdatedAt: true, createdAt: true, lastActiveAt: true, emailVerifiedAt: true },
    }),
  ]);

  return {
    users: { total, verified, newThisWeek, newThisMonth },
    active: { today: activeToday, week: activeWeek, month: activeMonth },
    signupsByWeek: signupsByWeek(recentSignups.map((u) => u.createdAt), now),
    features: [
      { key: "tracker", label: "Tracker entries", users: tracker },
      { key: "budgets", label: "Budgets", users: budgets },
      { key: "goals", label: "Goals", users: goals },
      { key: "netWorth", label: "Net worth and accounts", users: netWorth },
      { key: "transfers", label: "Transfers", users: transfers },
      { key: "recurring", label: "Recurring entries and bills", users: recurring },
      { key: "imports", label: "CSV import", users: imports },
      { key: "shared", label: "Shared groups", users: shared },
      { key: "asked", label: "Asked in Discuss", users: asked },
      { key: "replied", label: "Replied in Discuss", users: replied },
      { key: "following", label: "Following someone", users: following },
    ],
    discuss: { questions, replies, questionsThisWeek, repliesThisWeek },
    reports,
    people: {
      total,
      shown: people.map((p) => ({
        username: p.username,
        displayName: p.displayName,
        avatarUrl: avatarUrl(p),
        joinedAt: p.createdAt,
        lastActiveAt: p.lastActiveAt,
        verified: p.emailVerifiedAt !== null,
      })),
    },
  };
}

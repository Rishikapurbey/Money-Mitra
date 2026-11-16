// What the private admin page receives: counts and identity only, never anyone's money

export interface AdminPerson {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
  verified: boolean;
}

export interface AdminReport {
  kind: "question" | "reply";
  id: string;
  postId: string;
  title: string;
  excerpt: string;
  reports: number;
  reasons: { reason: string; count: number }[];
  hidden: boolean;
  lastReportedAt: string;
}

export interface AdminOverview {
  users: { total: number; verified: number; newThisWeek: number; newThisMonth: number };
  active: { today: number; week: number; month: number };
  signupsByWeek: { week: string; signups: number }[];
  features: { key: string; label: string; users: number }[];
  discuss: { questions: number; replies: number; questionsThisWeek: number; repliesThisWeek: number };
  reports: AdminReport[];
  people: { total: number; shown: AdminPerson[] };
}

const DAY = 24 * 60 * 60 * 1000;

// "16 Nov" for the week starting 2026-11-16
export const weekLabel = (week: string) =>
  new Date(`${week}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// How long ago someone used the app, in words that stay readable in a narrow column
export function lastActiveLabel(iso: string | null, now = new Date()) {
  if (!iso) return "Not yet";
  const then = new Date(iso);
  const days = Math.floor((startOfDay(now) - startOfDay(then)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return shortDate(iso);
}

// The same, as a phrase for the one-line summary on phones: "Active today", "Last active 7 Oct 2026"
export function activePhrase(iso: string | null, now = new Date()) {
  const label = lastActiveLabel(iso, now);
  if (!iso) return "Not active yet";
  if (/^\d+ days ago$/.test(label) || label === "Today" || label === "Yesterday") return `Active ${label.toLowerCase()}`;
  return `Last active ${label}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Share of all users, rounded, for the feature-use bars
export const percentOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

export const TOPICS = ["Budgeting", "Saving", "Investing", "Loans & Credit", "Tax", "Other"];

export interface Reply {
  id: string;
  body: string;
  isAnonymous: boolean;
  createdAt: string;
  author: string | null;
  isMine: boolean;
  hidden: boolean;
  helpfulCount: number;
  votedByMe: boolean;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  topic: string;
  isAnonymous: boolean;
  createdAt: string;
  author: string | null;
  isMine: boolean;
  replyCount?: number;
  replies?: Reply[];
  hidden: boolean;
}

export const REPORT_REASONS = [
  { key: "spam", label: "Spam" },
  { key: "abusive", label: "Abusive or hateful" },
  { key: "misleading", label: "Misleading money advice" },
  { key: "other", label: "Other" },
];

export const authorName = (item: { author: string | null; isMine: boolean }) => {
  if (item.author) return item.isMine ? `${item.author} (you)` : item.author;
  return item.isMine ? "Anonymous (you)" : "Anonymous";
};

export const timeAgo = (iso: string) => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const discussInputClass =
  "w-full border border-line bg-surface rounded-xl px-4 py-2.5 text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition";

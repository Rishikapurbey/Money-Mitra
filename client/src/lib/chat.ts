import type { AuthorProfile } from "./discuss";

// One-to-one chat, from /api/chats. A person of null means they deleted their account.

export const MAX_MESSAGE = 2000;
export const DELETED_TEXT = "This message was deleted";

export interface ChatSummary {
  id: string;
  person: AuthorProfile | null;
  lastMessage: { text: string; mine: boolean; deleted: boolean; createdAt: string };
  unread: boolean;
}

export interface ChatMessage {
  id: string;
  mine: boolean;
  body: string;
  deleted: boolean;
  createdAt: string;
}

export interface ChatInfo {
  id: string;
  person: AuthorProfile | null;
  myStatus: "accepted" | "request";
  waitingForThem: boolean;
  seenUpTo: string | null;
  canSend: boolean;
  cannotSendReason: string | null;
  blockedByMe: boolean;
}

// Matches the server's reasons for reporting a message
export const MESSAGE_REPORT_REASONS: { key: string; label: string }[] = [
  { key: "spam", label: "Spam" },
  { key: "abusive", label: "Abusive or harassing" },
  { key: "scam", label: "Scam or fraud" },
  { key: "other", label: "Other" },
];

export const personName = (person: AuthorProfile | null) => (person ? person.displayName || person.username : "Deleted user");

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const clock = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

// For the inbox: the time today, "Yesterday", the weekday this week, else the date
export function inboxTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (sameDay(d, now)) return clock(d);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  const days = (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString("en-IN", { weekday: "short" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }) });
}

// Under each message: just the time
export const messageTime = (iso: string) => clock(new Date(iso));

// The label between messages from different days: "Today", "Yesterday", or the date
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (sameDay(d, now)) return "Today";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }) });
}

export const startsNewDay = (messages: ChatMessage[], index: number) =>
  index === 0 || !sameDay(new Date(messages[index - 1]!.createdAt), new Date(messages[index]!.createdAt));

// Merges a freshly loaded page into what's on screen: newer copies win (e.g. a message that was
// since deleted), and messages loaded earlier by scrolling back are kept. Oldest first.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

// "Seen" goes under my latest message once the other person has read up to it
export function seenMessageId(messages: ChatMessage[], seenUpTo: string | null) {
  if (!seenUpTo) return null;
  const mine = [...messages].reverse().find((m) => m.mine && !m.deleted);
  if (!mine) return null;
  const last = messages[messages.length - 1];
  // Only when it's the newest message in the chat, as in WhatsApp
  if (last?.id !== mine.id) return null;
  return new Date(seenUpTo) >= new Date(mine.createdAt) ? mine.id : null;
}

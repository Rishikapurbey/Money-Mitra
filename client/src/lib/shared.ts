import type { AuthorProfile } from "./discuss";

export interface GroupMember {
  id: string;
  status: "active" | "invited" | "left";
  name: string;
  // Set for people on Money Mitra; null for friends added by name
  person: AuthorProfile | null;
  isMe: boolean;
  // A name-only member whose join link has been made
  linkShared: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  archived: boolean;
  members: GroupMember[];
}

export interface GroupInvite {
  id: string;
  groupName: string;
  memberCount: number;
  invitedBy: AuthorProfile | null;
}

export const joinLink = (token: string) => `${window.location.origin}/join/${token}`;

// "Asha, Ravi and 3 others", with the viewer as "You"
export function memberNames(members: GroupMember[], shown = 3) {
  const names = members.map((m) => (m.isMe ? "You" : m.name));
  if (names.length <= shown) return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
  const rest = names.length - shown;
  return `${names.slice(0, shown).join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

export interface SharedExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  paidById: string;
  shares: { memberId: string; amount: number }[];
}

export interface Settlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
}

export interface Payment {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  archived: boolean;
  myMemberId: string;
  members: (GroupMember & { balance: number })[];
  expenses: SharedExpense[];
  settlements: Settlement[];
  suggestedPayments: Payment[];
  activity: { id: string; message: string; createdAt: string }[];
}

const toPaise = (rupees: number) => Math.round(rupees * 100);

// The same split the server makes: leftover paise go one each to the first people
export function splitEqually(amount: number, count: number) {
  const total = toPaise(amount);
  if (count === 0 || !(total > 0)) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

// How much is left to assign in an exact split; zero when the shares match the total
export function unassigned(amount: number, shares: number[]) {
  return (toPaise(amount) - shares.reduce((sum, s) => sum + toPaise(s), 0)) / 100;
}

// Where the viewer stands on one expense
export function myPosition(expense: SharedExpense, myMemberId: string) {
  const share = expense.shares.find((s) => s.memberId === myMemberId)?.amount ?? 0;
  if (expense.paidById === myMemberId) {
    const lent = (toPaise(expense.amount) - toPaise(share)) / 100;
    return lent > 0 ? { kind: "lent" as const, amount: lent } : { kind: "none" as const, amount: 0 };
  }
  return share > 0 ? { kind: "owe" as const, amount: share } : { kind: "none" as const, amount: 0 };
}

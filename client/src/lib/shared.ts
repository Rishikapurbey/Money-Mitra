import type { AuthorProfile } from "./discuss";

export interface GroupMember {
  id: string;
  status: "active" | "invited";
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

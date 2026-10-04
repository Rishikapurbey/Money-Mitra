import type { AuthorProfile } from "./discuss";

export interface AppNotification {
  id: string;
  kind:
    | "reply_to_question"
    | "reply_in_thread"
    | "helpful"
    | "post_hidden"
    | "reply_hidden"
    | "follow_request"
    | "new_follower"
    | "follow_accepted"
    | "followed_post"
    | "budget_near"
    | "budget_over"
    | "recap_ready"
    | "answer_accepted"
    | "year_ready";
  message: string;
  // The question's title; empty for follow, budget and recap notifications
  title: string;
  // For recap_ready: the month (YYYY-MM) the recap covers
  month: string | null;
  // For year_ready: the year (YYYY) the review covers
  year: string | null;
  postId: string | null;
  // Who it's about, for follow notifications and new questions from people you follow
  actor: AuthorProfile | null;
  read: boolean;
  updatedAt: string;
}

// Where a notification leads when opened
export function notificationLink(n: AppNotification) {
  if (n.kind === "follow_request") return "/follow-requests";
  if (n.kind === "budget_near" || n.kind === "budget_over") return "/tracker";
  if (n.kind === "recap_ready" && n.month) return `/tracker/recap/${n.month}`;
  if (n.kind === "year_ready" && n.year) return `/tracker/year/${n.year}`;
  if (n.postId) return `/discuss/${n.postId}`;
  if (n.actor) return `/u/${n.actor.username}`;
  return "/discuss";
}

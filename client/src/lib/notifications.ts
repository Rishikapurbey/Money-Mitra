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
    | "budget_over";
  message: string;
  // The question's title; empty for follow and budget notifications
  title: string;
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
  if (n.postId) return `/discuss/${n.postId}`;
  if (n.actor) return `/u/${n.actor.username}`;
  return "/discuss";
}

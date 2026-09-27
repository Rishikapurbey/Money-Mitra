export interface AppNotification {
  id: string;
  kind: "reply_to_question" | "reply_in_thread" | "helpful" | "post_hidden" | "reply_hidden";
  message: string;
  title: string;
  postId: string;
  read: boolean;
  updatedAt: string;
}

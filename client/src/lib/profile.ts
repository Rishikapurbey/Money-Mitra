export interface ProfileQuestion {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  replyCount: number;
}

export interface ProfileReply {
  id: string;
  body: string;
  createdAt: string;
  helpfulCount: number;
  postId: string;
  postTitle: string;
}

export interface Profile {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  joinedAt: string;
  isPrivate: boolean;
  isMe: boolean;
  // null when the profile is private and it isn't yours
  activity: {
    questionCount: number;
    replyCount: number;
    helpfulCount: number;
    questions: ProfileQuestion[];
    replies: ProfileReply[];
  } | null;
}

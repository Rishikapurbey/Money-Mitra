// How you relate to someone: not following, waiting for them to accept your request, or following
export type FollowStatus = "none" | "requested" | "following";

// Someone in a followers or following list
export interface Person {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isMe: boolean;
  followStatus: FollowStatus;
}

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
  // Marked as the answer by the person who asked
  accepted: boolean;
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
  followerCount: number;
  followingCount: number;
  // null on your own profile
  followStatus: FollowStatus | null;
  followsYou: boolean;
  // Requests waiting for your answer; only on your own profile
  pendingRequests: number;
  // null when the profile is private and you're not an accepted follower
  activity: {
    questionCount: number;
    replyCount: number;
    helpfulCount: number;
    acceptedCount: number;
    questions: ProfileQuestion[];
    replies: ProfileReply[];
  } | null;
}

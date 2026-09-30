import api from "./api";

// The logged-in user, from /auth/me
export interface Me {
  email: string;
  username: string;
  createdAt: string;
  emailReplies: boolean;
  displayName: string | null;
  bio: string | null;
  isPrivate: boolean;
  anonymousByDefault: boolean;
  avatarUrl: string | null;
}

// How a person is named in the app: their chosen name, or else their username
export const nameOf = (person: { displayName: string | null; username: string }) => person.displayName || person.username;

// The API gives photo addresses relative to itself
export const photoSrc = (avatarUrl: string | null) => (avatarUrl ? `${api.defaults.baseURL}${avatarUrl}` : null);

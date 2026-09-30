// Everything shown for a person next to their posts: never their email, id or anything from the Tracker
export const identitySelect = { username: true, displayName: true, avatarUpdatedAt: true } as const;

interface IdentityFields {
  username: string;
  displayName: string | null;
  avatarUpdatedAt: Date | null;
}

// The photo's address changes whenever the photo does, so browsers can cache each version forever
export const avatarUrl = (user: { username: string; avatarUpdatedAt: Date | null }) =>
  user.avatarUpdatedAt ? `/users/${encodeURIComponent(user.username)}/avatar?v=${user.avatarUpdatedAt.getTime()}` : null;

export const identity = (user: IdentityFields) => ({
  username: user.username,
  displayName: user.displayName,
  avatarUrl: avatarUrl(user),
});

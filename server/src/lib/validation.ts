const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

// Placeholder account that owns Discuss posts after their author deletes their account
export const DELETED_USERNAME = "deleted_user";

// Names that could be mistaken for the app, staff, an anonymous poster or a deleted account
const RESERVED_USERNAMES = [
  "anonymous", "admin", "administrator", "moderator", "mod", "moneymitra", "money_mitra",
  "support", "system", "you", DELETED_USERNAME,
];

export const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Each returns an error message, or null when the value is acceptable
export function emailProblem(email: string): string | null {
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return "Please enter a valid email address";
  return null;
}

export function usernameProblem(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return "Username must be 3 to 20 characters: letters, numbers and underscores only";
  }
  if (RESERVED_USERNAMES.includes(username.toLowerCase())) return "That username isn't available";
  return null;
}

export function passwordProblem(password: string): string | null {
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently cut
  if (password.length < 8 || password.length > 72) return "Password must be 8 to 72 characters";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number";
  }
  return null;
}

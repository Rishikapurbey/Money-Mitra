// Browser storage keys for the dashboard's welcome checklist. The device can be shared, so reading
// a term stores when it happened (it counts for accounts created before then), and hiding the
// checklist is remembered per account.
export const LEARN_READ_KEY = "money-mitra:learn-term-read-at";
const CHECKLIST_HIDDEN_KEY = "money-mitra:checklist-hidden";
export const checklistHiddenKey = (username: string) => `${CHECKLIST_HIDDEN_KEY}:${username}`;

// Whether a Learn term was read on this device since the account was created
export function readLearnSince(createdAt: string) {
  try {
    const readAt = localStorage.getItem(LEARN_READ_KEY);
    return readAt !== null && new Date(readAt).getTime() >= new Date(createdAt).getTime();
  } catch {
    return false;
  }
}
// Lists of Learn term slugs, used to avoid suggesting the same tip twice
export const READ_TERMS_KEY = "money-mitra:read-terms";
export const DISMISSED_TIPS_KEY = "money-mitra:dismissed-tips";

export function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Unavailable storage just means the preference isn't remembered
  }
}

export function readList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function addToList(key: string, item: string) {
  try {
    const list = readList(key);
    if (!list.includes(item)) localStorage.setItem(key, JSON.stringify([...list, item]));
  } catch {
    // Unavailable storage just means the preference isn't remembered
  }
}

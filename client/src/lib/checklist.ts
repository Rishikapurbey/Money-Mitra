// Browser storage keys for the dashboard's welcome checklist
export const LEARN_READ_KEY = "money-mitra:read-learn-term";
export const CHECKLIST_HIDDEN_KEY = "money-mitra:checklist-hidden";
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

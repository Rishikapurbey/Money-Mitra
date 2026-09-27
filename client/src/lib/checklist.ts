// Browser storage keys for the dashboard's welcome checklist
export const LEARN_READ_KEY = "money-mitra:read-learn-term";
export const CHECKLIST_HIDDEN_KEY = "money-mitra:checklist-hidden";

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

import { useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "money-mitra:theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

let choice = readChoice();

// Puts the resolved theme on <html> (see index.css) and matches the browser's toolbar colour
function apply() {
  const dark = choice === "dark" || (choice === "system" && media.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1320" : "#0f1b2d");
  listeners.forEach((l) => l());
}

// Following the device: react when it switches between light and dark
media.addEventListener("change", () => choice === "system" && apply());
apply();

export function setTheme(next: ThemeChoice) {
  choice = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // Unavailable storage just means the choice lasts for this visit only
  }
  apply();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// The saved choice ("system", "light" or "dark") and whether the page is dark right now
export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => choice);
  const isDark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark");
  return { choice: current, isDark };
}

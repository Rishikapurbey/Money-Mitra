const KEY = "returnTo";

// Only addresses inside the app, so a crafted value can't send someone to another site
export const isAppPath = (path: string) => path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");

// Remembers the page a signed-out visitor tried to open, e.g. a group invite link
export function rememberReturnTo(path: string) {
  try {
    if (isAppPath(path)) sessionStorage.setItem(KEY, path);
  } catch {
    // Storage can be blocked; they'll just land on Home
  }
}

// Where to go after logging in or signing up; used once
export function takeReturnTo() {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (path && isAppPath(path)) return path;
  } catch {
    // Fall through to Home
  }
  return "/home";
}

import { useSyncExternalStore } from "react";

// Chrome and Edge (Android and desktop) offer to install the site as an app by firing
// "beforeinstallprompt". We keep that event so our own "Install app" button can use it.
// Safari never fires it; iPhone users install through Share > Add to Home Screen.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  notify();
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  notify();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Returns an install function when the browser allows installing, otherwise null
export function useInstallPrompt() {
  const available = useSyncExternalStore(subscribe, () => deferred !== null);
  if (!available) return null;
  return async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    notify();
  };
}

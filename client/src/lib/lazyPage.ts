import { lazy } from "react";
import type { ComponentType } from "react";

const RELOADED = "money-mitra:reloaded-for-new-version";

// Runs a page import. After a new deploy, a tab that was already open may ask for files that no
// longer exist; it then reloads once to pick up the new version instead of showing an error.
export function loadWithReload<T>(load: () => Promise<T>, reload: () => void = () => window.location.reload()): Promise<T> {
  return load().then(
    (page) => {
      try {
        sessionStorage.removeItem(RELOADED);
      } catch {
        // Storage can be unavailable (private windows); nothing to clear then
      }
      return page;
    },
    (err) => {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOADED) === "1";
        if (!alreadyReloaded) sessionStorage.setItem(RELOADED, "1");
      } catch {
        // Without storage we can't tell if we already tried, so don't risk a reload loop
      }
      if (alreadyReloaded) throw err;
      reload();
      return new Promise<never>(() => {});
    }
  );
}

// Loads a page's code the first time it's opened, so the first visit downloads less
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => loadWithReload(load));
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWithReload } from "./lazyPage";

// A minimal sessionStorage, since tests run outside a browser
function fakeStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("loadWithReload", () => {
  beforeEach(() => vi.stubGlobal("sessionStorage", fakeStorage()));

  it("returns the page when it loads", async () => {
    const reload = vi.fn();
    await expect(loadWithReload(() => Promise.resolve("page"), reload)).resolves.toBe("page");
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when a page's file is missing, then gives up instead of looping", async () => {
    const reload = vi.fn();
    const missing = () => Promise.reject(new Error("Failed to fetch dynamically imported module"));

    void loadWithReload(missing, reload);
    await settled();
    expect(reload).toHaveBeenCalledTimes(1);

    // After the reload, the same failure is shown instead of reloading again
    await expect(loadWithReload(missing, reload)).rejects.toThrow("Failed to fetch");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("can reload again after a later deploy, once a page has loaded fine in between", async () => {
    const reload = vi.fn();
    const missing = () => Promise.reject(new Error("missing"));
    void loadWithReload(missing, reload);
    await settled();
    await loadWithReload(() => Promise.resolve("page"), reload);
    void loadWithReload(missing, reload);
    await settled();
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

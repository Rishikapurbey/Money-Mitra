import { describe, expect, it } from "vitest";
import { activePhrase, lastActiveLabel, percentOf, plural } from "./admin";

describe("admin page helpers", () => {
  const now = new Date(2026, 10, 16, 10, 0);

  it("says how long ago someone was active, by calendar day", () => {
    expect(lastActiveLabel(null, now)).toBe("Not yet");
    expect(lastActiveLabel(new Date(2026, 10, 16, 0, 5).toISOString(), now)).toBe("Today");
    expect(lastActiveLabel(new Date(2026, 10, 15, 23, 50).toISOString(), now)).toBe("Yesterday");
    expect(lastActiveLabel(new Date(2026, 10, 6, 12, 0).toISOString(), now)).toBe("10 days ago");
    expect(lastActiveLabel(new Date(2026, 8, 1, 12, 0).toISOString(), now)).toMatch(/2026/);
  });

  it("turns that into a phrase without lowercasing month names", () => {
    expect(activePhrase(null, now)).toBe("Not active yet");
    expect(activePhrase(new Date(2026, 10, 16, 0, 5).toISOString(), now)).toBe("Active today");
    expect(activePhrase(new Date(2026, 10, 6, 12, 0).toISOString(), now)).toBe("Active 10 days ago");
    expect(activePhrase(new Date(2026, 9, 7, 12, 0).toISOString(), now)).toMatch(/^Last active 7 Oct/);
  });

  it("rounds shares and copes with no users", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBe(0);
  });

  it("pluralises counts", () => {
    expect(plural(1, "report")).toBe("1 report");
    expect(plural(1200, "person", "people")).toBe("1,200 people");
  });
});

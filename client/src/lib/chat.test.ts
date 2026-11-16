import { describe, expect, it } from "vitest";
import { dayLabel, inboxTime, mergeMessages, personName, seenMessageId, startsNewDay } from "./chat";
import type { ChatMessage } from "./chat";

const msg = (id: string, iso: string, mine = false, deleted = false): ChatMessage => ({ id, mine, body: deleted ? "" : id, deleted, createdAt: iso });

describe("chat helpers", () => {
  const now = new Date(2026, 10, 16, 18, 0);

  it("labels times in the inbox and days in a chat", () => {
    expect(inboxTime(new Date(2026, 10, 16, 9, 5).toISOString(), now)).toMatch(/9:05/);
    expect(inboxTime(new Date(2026, 10, 15, 23, 0).toISOString(), now)).toBe("Yesterday");
    expect(inboxTime(new Date(2026, 10, 1, 12, 0).toISOString(), now)).toMatch(/1 Nov/);
    expect(dayLabel(new Date(2026, 10, 16, 1, 0).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 10, 15, 1, 0).toISOString(), now)).toBe("Yesterday");
  });

  it("merges a new page over what's shown, keeping older messages and newer copies", () => {
    const shown = [msg("a", "2026-11-16T10:00:00Z"), msg("b", "2026-11-16T10:01:00Z", true)];
    const fresh = [msg("b", "2026-11-16T10:01:00Z", true, true), msg("c", "2026-11-16T10:02:00Z")];
    const merged = mergeMessages(shown, fresh);
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(merged[1]!.deleted).toBe(true);
  });

  it("shows Seen only under my newest message, once it's been read", () => {
    const list = [msg("a", "2026-11-16T10:00:00Z"), msg("b", "2026-11-16T10:01:00Z", true)];
    expect(seenMessageId(list, null)).toBeNull();
    expect(seenMessageId(list, "2026-11-16T10:00:30Z")).toBeNull();
    expect(seenMessageId(list, "2026-11-16T10:05:00Z")).toBe("b");
    // A reply after it means there's nothing to mark
    expect(seenMessageId([...list, msg("c", "2026-11-16T10:06:00Z")], "2026-11-16T10:07:00Z")).toBeNull();
  });

  it("starts a new day group and names deleted accounts", () => {
    const list = [msg("a", new Date(2026, 10, 15, 22).toISOString()), msg("b", new Date(2026, 10, 15, 23).toISOString()), msg("c", new Date(2026, 10, 16, 9).toISOString())];
    expect([0, 1, 2].map((i) => startsNewDay(list, i))).toEqual([true, false, true]);
    expect(personName(null)).toBe("Deleted user");
    expect(personName({ username: "asha", displayName: "Asha K", avatarUrl: null })).toBe("Asha K");
  });
});

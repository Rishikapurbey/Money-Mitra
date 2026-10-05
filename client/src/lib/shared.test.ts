import { describe, expect, it } from "vitest";
import { memberNames } from "./shared";
import type { GroupMember } from "./shared";

const member = (name: string, isMe = false): GroupMember => ({ id: name, status: "active", name, person: null, isMe, linkShared: false });

describe("memberNames", () => {
  it("lists a few names and counts the rest", () => {
    expect(memberNames([member("asha", true)])).toBe("You");
    expect(memberNames([member("asha", true), member("Ravi")])).toBe("You and Ravi");
    expect(memberNames([member("a", true), member("B"), member("C")])).toBe("You, B and C");
    expect(memberNames([member("a", true), member("B"), member("C"), member("D")])).toBe("You, B, C and 1 other");
    expect(memberNames([member("a"), member("B"), member("C"), member("D"), member("E")])).toBe("a, B, C and 2 others");
  });
});

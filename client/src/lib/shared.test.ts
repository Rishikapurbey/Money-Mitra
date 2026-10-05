import { describe, expect, it } from "vitest";
import { memberNames, myPosition, splitEqually, unassigned } from "./shared";
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

describe("split helpers", () => {
  it("splits like the server, and tracks what's left to assign", () => {
    expect(splitEqually(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitEqually(100, 0)).toEqual([]);
    expect(unassigned(100, [33.34, 33.33])).toBe(33.33);
    expect(unassigned(0.3, [0.1, 0.2])).toBe(0);
  });

  it("says what the viewer lent or owes", () => {
    const expense = { id: "e", description: "Dinner", amount: 900, category: "Food", date: "", paidById: "me", shares: [
      { memberId: "me", amount: 300 },
      { memberId: "b", amount: 600 },
    ] };
    expect(myPosition(expense, "me")).toEqual({ kind: "lent", amount: 600 });
    expect(myPosition(expense, "b")).toEqual({ kind: "owe", amount: 600 });
    expect(myPosition(expense, "c")).toEqual({ kind: "none", amount: 0 });
  });
});

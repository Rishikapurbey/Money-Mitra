import { describe, expect, it } from "vitest";
import { balances, simplifyDebts, splitEqually, toPaise } from "../src/modules/shared/split";

describe("splitEqually", () => {
  it("adds up exactly, giving leftover paise to the first members", () => {
    expect(splitEqually(10000, ["a", "b", "c"]).map((s) => s.amount)).toEqual([3334, 3333, 3333]);
    expect(splitEqually(10002, ["a", "b", "c"]).map((s) => s.amount)).toEqual([3334, 3334, 3334]);
    expect(splitEqually(1, ["a", "b"]).map((s) => s.amount)).toEqual([1, 0]);
  });

  it("converts rupees without floating point drift", () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(1199.99)).toBe(119999);
  });
});

describe("balances and simplifying", () => {
  it("credits the payer, charges the shares and applies paybacks", () => {
    const balance = balances(["a", "b", "c"], {
      expenses: [{ paidById: "a", amount: 1200, shares: splitEqually(1200, ["a", "b", "c"]) }],
      settlements: [{ fromMemberId: "b", toMemberId: "a", amount: 400 }],
    });
    expect(Object.fromEntries(balance)).toEqual({ a: 400, b: 0, c: -400 });
  });

  it("settles everyone in as few payments as it can", () => {
    const balance = new Map([
      ["a", 3000],
      ["b", -1000],
      ["c", -1000],
      ["d", -1000],
      ["e", 0],
    ]);
    const payments = simplifyDebts(balance);
    expect(payments).toEqual([
      { fromMemberId: "b", toMemberId: "a", amount: 1000 },
      { fromMemberId: "c", toMemberId: "a", amount: 1000 },
      { fromMemberId: "d", toMemberId: "a", amount: 1000 },
    ]);
  });

  it("chains debts through the group instead of everyone paying everyone", () => {
    // a paid for b, b paid for c: c can pay a directly
    const balance = balances(["a", "b", "c"], {
      expenses: [
        { paidById: "a", amount: 500, shares: [{ memberId: "b", amount: 500 }] },
        { paidById: "b", amount: 500, shares: [{ memberId: "c", amount: 500 }] },
      ],
      settlements: [],
    });
    expect(simplifyDebts(balance)).toEqual([{ fromMemberId: "c", toMemberId: "a", amount: 500 }]);
    expect(simplifyDebts(new Map([["a", 0]]))).toEqual([]);
  });
});

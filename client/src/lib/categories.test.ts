import { describe, expect, it } from "vitest";
import { quickPicks, usageSummary } from "./categories";

const list = [
  { name: "Bills", type: "expense" },
  { name: "Food", type: "expense" },
  { name: "Rent", type: "expense" },
  { name: "Salary", type: "income" },
];

describe("quickPicks", () => {
  it("puts recent categories first, then fills from the list for that type", () => {
    expect(quickPicks(["Rent"], list, "expense")).toEqual(["Rent", "Bills", "Food"]);
    expect(quickPicks([], list, "income")).toEqual(["Salary"]);
  });

  it("skips repeats in any capitalisation and stops at the limit", () => {
    expect(quickPicks(["food", "Chai"], list, "expense", 3)).toEqual(["food", "Chai", "Bills"]);
  });
});

describe("usageSummary", () => {
  it("describes what uses a category", () => {
    expect(usageSummary({ transactions: 1, recurring: 0, hasBudget: false })).toBe("1 transaction");
    expect(usageSummary({ transactions: 12, recurring: 1, hasBudget: true })).toBe("12 transactions · 1 recurring · budget");
    expect(usageSummary({ transactions: 0, recurring: 0, hasBudget: false })).toBeNull();
  });
});

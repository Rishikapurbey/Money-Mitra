import { describe, expect, it } from "vitest";
import { chooseTip } from "./tips";
import { TERMS } from "./learn";

const base = { income: 0, expense: 0, categories: [], goalNames: [], skip: new Set<string>(), dayIndex: 0 };

describe("chooseTip", () => {
  it("suggests an emergency fund when there is income but no such goal", () => {
    expect(chooseTip({ ...base, income: 50000, expense: 45000 })?.slug).toBe("emergency-fund");
    expect(chooseTip({ ...base, income: 50000, expense: 45000, goalNames: ["Emergency fund"] })?.slug).not.toBe("emergency-fund");
  });

  it("suggests budgeting when spending is more than income", () => {
    const tip = chooseTip({ ...base, income: 20000, expense: 25000, goalNames: ["Emergency"] });
    expect(tip?.slug).toBe("budget");
  });

  it("spots loan payments by category name", () => {
    const tip = chooseTip({ ...base, categories: ["Home loan"], skip: new Set() });
    expect(tip?.slug).toBe("emi");
    expect(chooseTip({ ...base, categories: ["Chemist"] })?.slug).not.toBe("emi");
  });

  it("suggests SIPs to people saving at least 20%", () => {
    const tip = chooseTip({ ...base, income: 50000, expense: 30000, goalNames: ["Emergency fund"] });
    expect(tip?.slug).toBe("sip");
  });

  it("never repeats a read or dismissed tip, falling back to a term of the day", () => {
    const tip = chooseTip({ ...base, income: 50000, expense: 45000, skip: new Set(["emergency-fund"]), dayIndex: 3 });
    expect(tip).toEqual({ slug: TERMS[3].slug, headline: `Term of the day: ${TERMS[3].term}` });
  });

  it("returns nothing once every term has been read", () => {
    expect(chooseTip({ ...base, skip: new Set(TERMS.map((t) => t.slug)) })).toBeNull();
  });
});

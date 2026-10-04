import { describe, expect, it } from "vitest";
import { isMonthKey, monthKey, percentChange, shiftMonth } from "./recap";

describe("recap months", () => {
  it("formats and steps months across years", () => {
    expect(monthKey(new Date(2026, 8, 30))).toBe("2026-09");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("only accepts real months", () => {
    expect(isMonthKey("2026-09")).toBe(true);
    for (const bad of ["2026-13", "2026-9", "september", undefined]) expect(isMonthKey(bad)).toBe(false);
  });

  it("works out changes only when there is something to compare with", () => {
    expect(percentChange(1200, 1000)).toBe(20);
    expect(percentChange(800, 1000)).toBe(-20);
    expect(percentChange(500, 0)).toBeNull();
  });
});

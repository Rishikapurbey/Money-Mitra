import { describe, expect, it } from "vitest";
import { billsDue, dueLabel, ordinal, ruleName, scheduleLabel } from "./recurring";
import type { RecurringRule } from "./recurring";

describe("ordinal", () => {
  it("names days of the month", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st",
    ]);
  });
});

describe("bills", () => {
  const now = new Date(2026, 9, 5, 10, 0); // 5 Oct, 10am local
  const rule = (overrides: Partial<RecurringRule> = {}): RecurringRule => ({
    id: "r",
    amount: null,
    type: "expense",
    category: "Bills",
    note: null,
    mode: "remind",
    frequency: "monthly",
    dayOfMonth: 7,
    monthOfYear: null,
    nextDue: new Date(2026, 9, 7, 12).toISOString(),
    endDate: null,
    paused: false,
    ...overrides,
  });

  it("describes when a bill is due", () => {
    expect(dueLabel(new Date(2026, 9, 5, 12).toISOString(), now)).toBe("Due today");
    expect(dueLabel(new Date(2026, 9, 6, 12).toISOString(), now)).toBe("Due tomorrow");
    expect(dueLabel(new Date(2026, 9, 12, 12).toISOString(), now)).toBe("Due in 7 days");
    expect(dueLabel(new Date(2026, 9, 1, 12).toISOString(), now)).toBe("Overdue since 1 Oct");
  });

  it("describes the schedule and names the bill", () => {
    expect(scheduleLabel(rule())).toBe("Every month on the 7th");
    expect(scheduleLabel(rule({ frequency: "yearly", monthOfYear: 2, dayOfMonth: 20 }))).toBe("Every year on 20 Mar");
    expect(ruleName(rule({ note: "Credit card" }))).toBe("Credit card");
    expect(ruleName(rule())).toBe("Bills");
  });

  it("lists bills that are overdue or due within a week, soonest first", () => {
    const later = rule({ id: "later", nextDue: new Date(2026, 9, 20, 12).toISOString() });
    const overdue = rule({ id: "overdue", nextDue: new Date(2026, 9, 1, 12).toISOString() });
    const auto = rule({ id: "auto", mode: "auto" });
    const paused = rule({ id: "paused", paused: true });
    expect(billsDue([rule(), later, overdue, auto, paused], now).map((r) => r.id)).toEqual(["overdue", "r"]);
  });
});

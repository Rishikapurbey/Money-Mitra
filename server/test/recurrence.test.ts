import { describe, expect, it } from "vitest";
import { dueOccurrences, firstOnOrAfter, nextAfter, occurrenceIn, toLocalDate } from "../src/modules/recurring/recurrence";

const IST = -330;
const local = (d: Date) => {
  const { year, month, day } = toLocalDate(d, IST);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

describe("recurrence dates", () => {
  it("stamps entries at midday local time", () => {
    // Midday in India is 06:30 UTC
    expect(occurrenceIn(2026, 9, 1, IST).toISOString()).toBe("2026-10-01T06:30:00.000Z");
  });

  it("uses the last day of shorter months", () => {
    expect(local(occurrenceIn(2026, 8, 31, IST))).toBe("2026-09-30");
    expect(local(occurrenceIn(2027, 1, 31, IST))).toBe("2027-02-28");
    expect(local(occurrenceIn(2028, 1, 30, IST))).toBe("2028-02-29"); // leap year
  });

  it("goes back to the chosen day after a short month", () => {
    const feb = occurrenceIn(2027, 1, 31, IST);
    expect(local(nextAfter(feb, 31, IST))).toBe("2027-03-31");
  });

  it("rolls over the year", () => {
    expect(local(nextAfter(occurrenceIn(2026, 11, 15, IST), 15, IST))).toBe("2027-01-15");
  });

  it("finds the first entry on or after a date", () => {
    const sept20 = new Date("2026-09-20T10:00:00Z");
    expect(local(firstOnOrAfter(sept20, 25, IST))).toBe("2026-09-25");
    expect(local(firstOnOrAfter(sept20, 20, IST))).toBe("2026-09-20");
    expect(local(firstOnOrAfter(sept20, 1, IST))).toBe("2026-10-01");
  });

  it("uses the user's local day, not UTC", () => {
    // 20:00 UTC on 30 Sept is already 1 Oct in India
    expect(local(firstOnOrAfter(new Date("2026-09-30T20:00:00Z"), 1, IST))).toBe("2026-10-01");
  });

  it("lists every missed month once and respects the end date", () => {
    const start = occurrenceIn(2026, 5, 5, IST); // 5 June
    const now = new Date("2026-09-28T12:00:00Z");
    const all = dueOccurrences(start, now, 5, IST, null);
    expect(all.due.map(local)).toEqual(["2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05"]);
    expect(local(all.nextDue)).toBe("2026-10-05");

    const ending = dueOccurrences(start, now, 5, IST, new Date("2026-07-31T00:00:00Z"));
    expect(ending.due.map(local)).toEqual(["2026-06-05", "2026-07-05"]);
  });

  it("adds nothing before the date is due", () => {
    const next = occurrenceIn(2026, 9, 1, IST);
    expect(dueOccurrences(next, new Date("2026-09-28T00:00:00Z"), 1, IST, null).due).toEqual([]);
  });
});

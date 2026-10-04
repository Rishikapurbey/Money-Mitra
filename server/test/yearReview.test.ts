import { beforeAll, describe, expect, it } from "vitest";
import { computeYearReview } from "../src/modules/recaps/yearReview";
import type { YearInput } from "../src/modules/recaps/yearReview";
import type { RecapTransaction } from "../src/modules/recaps/recap";
import { getYearReview, latestRecap, monthBounds } from "../src/modules/recaps/recap.service";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";

beforeAll(resetDatabase);

const IST = -330;
const monthsOf = (year: string, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const b = monthBounds(month, IST);
    return { month, label: b.shortName.slice(0, 3), name: b.shortName, from: b.from, to: b.to };
  });

// Midday IST on a day of 2026
const tx = (type: "income" | "expense", category: string, amount: number, month: number, day = 10): RecapTransaction => ({
  type,
  category,
  amount,
  note: null,
  date: new Date(Date.UTC(2026, month - 1, day, 6, 30)),
  recurringId: null,
});

function run(current: RecapTransaction[], overrides: Partial<YearInput> = {}) {
  return computeYearReview({
    year: "2026",
    months: monthsOf("2026", 12),
    inProgress: false,
    now: new Date("2027-01-05T06:30:00Z"),
    current,
    previous: [],
    budgets: [],
    goals: [],
    ...overrides,
  });
}

describe("computeYearReview", () => {
  const year = [
    tx("income", "Salary", 50000, 10),
    tx("expense", "Rent", 15000, 10),
    tx("expense", "Food", 5000, 10),
    tx("income", "Salary", 50000, 11),
    tx("expense", "Rent", 15000, 11),
    tx("expense", "Food", 12000, 11),
    tx("income", "Salary", 50000, 12),
    tx("expense", "Rent", 15000, 12),
    tx("expense", "Food", 3000, 12),
    tx("expense", "Shopping", 1000, 12),
  ];

  it("starts from the first month with entries, and finds the best and toughest months", () => {
    const review = run(year);
    expect(review.months.map((m) => [m.label, m.saved])).toEqual([
      ["Oct", 30000],
      ["Nov", 23000],
      ["Dec", 31000],
    ]);
    expect(review.totals).toMatchObject({ income: 150000, expense: 66000, saved: 84000, savingsRate: 56 });
    expect(review.bestMonth).toMatchObject({ name: "December", saved: 31000 });
    expect(review.toughestMonth).toMatchObject({ name: "November", saved: 23000 });
    expect(review.categories[0]).toEqual({ name: "Rent", amount: 45000, share: 68, perMonth: 15000 });
    expect(review.enoughData).toBe(true);
  });

  it("counts the months each budget held, and writes highlights", () => {
    const review = run(year, {
      budgets: [{ category: "food", amount: 6000 }],
      goals: [{ name: "Emergency fund", savedAmount: 30000, targetAmount: 100000, added: 20000 }],
    });
    expect(review.budgets).toEqual([{ category: "food", limit: 6000, monthsWithin: 2, monthsCounted: 3 }]);
    expect(review.goalsAdded).toBe(20000);
    expect(review.highlights).toEqual([
      "You saved **₹84,000**, **56%** of what you earned.",
      "Your best month was **December**, when you saved ₹31,000.",
      "**Rent** was your biggest expense: ₹45,000, about ₹15,000 a month.",
      "You put **₹20,000** towards your goals.",
    ]);
  });

  it("leaves the running month out of best, toughest and budget counts while the year is in progress", () => {
    const review = run(year, { months: monthsOf("2026", 12), inProgress: true, now: new Date("2026-12-15T06:30:00Z") });
    expect(review.bestMonth?.name).toBe("October");
    expect(review.toughestMonth?.name).toBe("November");
    expect(review.highlights[0]).toBe("You saved **₹84,000** so far, **56%** of what you earned.");
  });

  it("compares spending with the year before once the year is over", () => {
    const review = run(year, { previous: [{ ...tx("expense", "Food", 90000, 6), date: new Date("2025-06-10T06:30:00Z") }] });
    expect(review.highlights).toContain("You spent **27% less** than the year before.");
  });

  it("says when there isn't enough to go on", () => {
    expect(run(year.slice(0, 4)).enoughData).toBe(false);
  });
});

describe("year review service", () => {
  const add = (auth: string, body: Record<string, unknown>) => api().post("/api/transactions").set("Authorization", auth).send(body).expect(201);

  it("shows the year so far, refuses future years and links to neighbouring years", async () => {
    const user = await createUser("year");
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email: user.email } })).id;
    await add(user.auth, { amount: 1000, type: "expense", category: "Food", date: "2025-11-10T06:30:00Z" });
    await add(user.auth, { amount: 50000, type: "income", category: "Salary", date: "2026-03-01T06:30:00Z" });

    const now = new Date("2026-10-04T06:30:00Z");
    const review = await getYearReview(userId, "2026", IST, now);
    expect(review).toMatchObject({ inProgress: true, firstYear: "2025", nextYear: null });
    expect(review.months.map((m) => m.label)).toEqual(["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect((await getYearReview(userId, "2025", IST, now)).nextYear).toBe("2026");
    await expect(getYearReview(userId, "2027", IST, now)).rejects.toThrow("This year hasn't started yet");
    await api().get("/api/recaps/year/26").set("Authorization", user.auth).expect(400);
  });

  it("shows last year on Home in January's first two weeks, announces it once, and can be closed", async () => {
    const user = await createUser("yearcard");
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email: user.email } })).id;
    for (let month = 1; month <= 10; month++) {
      await add(user.auth, { amount: 1000, type: "expense", category: "Food", date: `2026-${String(month).padStart(2, "0")}-10T06:30:00Z` });
    }
    const january = new Date("2027-01-08T06:30:00Z");

    const first = await latestRecap(userId, IST, january);
    expect(first.year).toMatchObject({ year: "2026", totals: { expense: 10000 } });
    expect(first.notified).toBe(true);
    expect((await latestRecap(userId, IST, january)).notified).toBe(false);
    const bell = (await api().get("/api/notifications").set("Authorization", user.auth).expect(200)).body.notifications;
    expect(bell).toContainEqual(expect.objectContaining({ kind: "year_ready", message: "Your 2026 in money is ready", year: "2026" }));

    expect((await latestRecap(userId, IST, new Date("2027-01-20T06:30:00Z"))).year).toBeNull();
    await api().post("/api/recaps/year/2026/dismiss").set("Authorization", user.auth).expect(200);
    expect((await latestRecap(userId, IST, january)).year).toBeNull();
  });
});

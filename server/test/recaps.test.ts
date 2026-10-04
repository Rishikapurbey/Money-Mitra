import { beforeAll, describe, expect, it } from "vitest";
import { computeRecap } from "../src/modules/recaps/recap";
import type { RecapInput, RecapTransaction } from "../src/modules/recaps/recap";
import { getRecap, latestRecap, monthBounds, shiftMonth } from "../src/modules/recaps/recap.service";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";
import { localMonth } from "../src/modules/budgets/budgetAlert.service";

beforeAll(resetDatabase);

const IST = -330;
const sept = monthBounds("2026-09", IST);

const tx = (type: "income" | "expense", category: string, amount: number, day = 10, extra: Partial<RecapTransaction> = {}): RecapTransaction => ({
  type,
  category,
  amount,
  note: null,
  // Midday IST on that day of September
  date: new Date(Date.UTC(2026, 8, day, 6, 30)),
  recurringId: null,
  ...extra,
});

function run(current: RecapTransaction[], overrides: Partial<RecapInput> = {}) {
  return computeRecap({
    month: "2026-09",
    from: sept.from,
    to: sept.to,
    current,
    previous: [],
    budgets: [],
    goals: [],
    monthName: "September 2026",
    previousMonthName: "August",
    ...overrides,
  });
}

describe("computeRecap", () => {
  it("adds up the month and compares it with the one before", () => {
    const recap = run([tx("income", "Salary", 50000), tx("expense", "Food", 6000), tx("expense", "Rent", 15000)], {
      previous: [tx("income", "Salary", 50000), tx("expense", "Food", 4000), tx("expense", "Rent", 15000)],
    });
    expect(recap.totals).toEqual({ income: 50000, expense: 21000, saved: 29000, savingsRate: 58 });
    expect(recap.previous).toEqual({ income: 50000, expense: 19000, saved: 31000, savingsRate: 62 });
    expect(recap.categories).toEqual([
      { name: "Rent", amount: 15000, share: 71, previous: 15000, changePct: 0 },
      { name: "Food", amount: 6000, share: 29, previous: 4000, changePct: 50 },
    ]);
    expect(recap.toWatch).toBe("You spent **50% more on Food** than in August (₹6,000 vs ₹4,000).");
    expect(recap.enoughData).toBe(true);
  });

  it("checks budgets, matching categories regardless of capitals, worst first", () => {
    const recap = run([tx("expense", "food", 9000), tx("expense", "Transport", 900), tx("income", "Salary", 50000)], {
      budgets: [
        { category: "Transport", amount: 2000 },
        { category: "Food", amount: 8000 },
      ],
    });
    expect(recap.budgets).toEqual([
      { category: "Food", limit: 8000, spent: 9000, over: true },
      { category: "Transport", limit: 2000, spent: 900, over: false },
    ]);
    expect(recap.toWatch).toBe("You went **₹1,000 over** your **Food** budget.");
    expect(recap.learnSlug).toBe("budget");
  });

  it("praises keeping every budget, and spending more than earning comes first in what to watch", () => {
    const kept = run([tx("expense", "Food", 500), tx("expense", "Rent", 100), tx("income", "Salary", 1000)], {
      budgets: [{ category: "Food", amount: 1000 }, { category: "Rent", amount: 1000 }],
    });
    expect(kept.wentWell).toBe("You stayed **within all 2 budgets**.");

    const overspent = run([tx("expense", "Food", 5000), tx("income", "Salary", 3000), tx("expense", "Rent", 100)]);
    expect(overspent.toWatch).toBe("You spent **₹2,100 more** than you earned.");
  });

  it("finds the biggest expense, days without spending and recurring payments", () => {
    const recap = run([
      tx("expense", "Rent", 15000, 1, { recurringId: "r1", note: "Flat rent" }),
      tx("expense", "Food", 200, 1),
      tx("expense", "Food", 300, 2),
      // Just before midnight IST on the 30th is still September
      { ...tx("expense", "Food", 100), date: new Date("2026-09-30T18:00:00Z") },
      tx("income", "Salary", 50000, 1),
    ]);
    expect(recap.biggestExpense).toMatchObject({ amount: 15000, category: "Rent", note: "Flat rent" });
    expect(recap.daysInMonth).toBe(30);
    expect(recap.noSpendDays).toBe(27);
    expect(recap.recurringTotal).toBe(15000);
  });

  it("picks a Learn term to fit the month", () => {
    const saver = run([tx("income", "Salary", 10000), tx("expense", "Food", 5000), tx("expense", "Rent", 1000)]);
    expect(saver.learnSlug).toBe("sip");
    const steady = run([tx("income", "Salary", 10000), tx("expense", "Food", 8000), tx("expense", "Rent", 500)]);
    expect(steady.learnSlug).toBe("emergency-fund");
  });

  it("says when there isn't enough to go on", () => {
    expect(run([tx("expense", "Food", 100)]).enoughData).toBe(false);
  });
});

describe("months", () => {
  it("steps across years and works in the user's timezone", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(sept.from.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(sept.name).toBe("September 2026");
  });
});

describe("recap service and routes", () => {
  const add = (auth: string, body: Record<string, unknown>) => api().post("/api/transactions").set("Authorization", auth).send(body).expect(201);
  const userIdOf = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

  it("refuses months that haven't finished, and checks the month's format", async () => {
    const user = await createUser("recap_routes");
    const thisMonth = localMonth(new Date(), 0).key;
    await api().get(`/api/recaps/${thisMonth}`).set("Authorization", user.auth).expect(400);
    await api().get(`/api/recaps/${shiftMonth(thisMonth, 1)}`).set("Authorization", user.auth).expect(400);
    await api().get("/api/recaps/2026-13").set("Authorization", user.auth).expect(400);
    const past = await api().get("/api/recaps/2020-01").set("Authorization", user.auth).query({ tzOffset: IST }).expect(200);
    expect(past.body.recap).toMatchObject({ month: "2020-01", enoughData: false, firstMonth: null });
  });

  it("shows last month on Home in the first week, announces it once, and can be closed", async () => {
    const user = await createUser("recap_latest");
    const userId = await userIdOf(user.email);
    for (const [amount, type, category] of [[50000, "income", "Salary"], [6000, "expense", "Food"], [15000, "expense", "Rent"]] as const) {
      await add(user.auth, { amount, type, category, date: "2026-09-15T06:30:00Z" });
    }
    const firstWeek = new Date("2026-10-04T06:30:00Z");

    const latest = await latestRecap(userId, IST, firstWeek);
    expect(latest.recap).toMatchObject({ month: "2026-09", monthName: "September 2026", totals: { saved: 29000 } });
    expect(latest.notified).toBe(true);
    expect((await latestRecap(userId, IST, firstWeek)).notified).toBe(false);
    const bell = (await api().get("/api/notifications").set("Authorization", user.auth).expect(200)).body.notifications;
    expect(bell.filter((n: { kind: string }) => n.kind === "recap_ready")).toEqual([
      expect.objectContaining({ message: "Your September recap is ready", title: "", month: "2026-09" }),
    ]);

    expect((await latestRecap(userId, IST, new Date("2026-10-09T06:30:00Z"))).recap).toBeNull();

    await api().post("/api/recaps/2026-09/dismiss").set("Authorization", user.auth).expect(200);
    expect((await latestRecap(userId, IST, firstWeek)).recap).toBeNull();
  });

  it("skips months with too few entries and links to neighbouring months", async () => {
    const user = await createUser("recap_sparse");
    const userId = await userIdOf(user.email);
    await add(user.auth, { amount: 100, type: "expense", category: "Food", date: "2026-08-10T06:30:00Z" });
    expect((await latestRecap(userId, IST, new Date("2026-09-02T06:30:00Z"))).recap).toBeNull();

    const recap = await getRecap(userId, "2026-08", IST, new Date("2026-10-04T06:30:00Z"));
    expect(recap).toMatchObject({ firstMonth: "2026-08", nextMonth: "2026-09" });
    const last = await getRecap(userId, "2026-09", IST, new Date("2026-10-04T06:30:00Z"));
    expect(last.nextMonth).toBeNull();
  });

  it("keeps each user's recap to their own entries", async () => {
    const owner = await createUser("recap_owner");
    const other = await createUser("recap_other");
    await add(owner.auth, { amount: 999, type: "expense", category: "Food", date: "2026-09-15T06:30:00Z" });
    const recap = await getRecap(await userIdOf(other.email), "2026-09", IST, new Date("2026-10-04T06:30:00Z"));
    expect(recap.totals.expense).toBe(0);
  });
});

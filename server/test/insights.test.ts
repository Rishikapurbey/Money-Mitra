import { describe, expect, it } from "vitest";
import { computeInsights } from "../src/modules/transactions/insights";
import type { InsightBudget, InsightTransaction } from "../src/modules/transactions/insights";
import { api, createUser, resetDatabase } from "./helpers";

const from = new Date("2026-09-01T00:00:00Z");
const to = new Date("2026-10-01T00:00:00Z");
const midMonth = new Date("2026-09-21T00:00:00Z"); // 20 of 30 days gone, 10 left
const afterMonth = new Date("2026-10-05T00:00:00Z");

const tx = (type: "income" | "expense", category: string, amount: number): InsightTransaction => ({ type, category, amount });

function run(
  current: InsightTransaction[],
  { previous = [] as InsightTransaction[], budgets = [] as InsightBudget[], now = afterMonth } = {}
) {
  return computeInsights({ current, previous, budgets, from, to, now, previousMonthName: "August" });
}

const ids = (insights: { id: string }[]) => insights.map((i) => i.id);

describe("insights", () => {
  it("asks for more data instead of guessing", () => {
    expect(ids(run([tx("expense", "Food", 100), tx("income", "Salary", 5000)]))).toEqual(["not-enough-data"]);
  });

  it("reports going over a budget, matching categories regardless of capitals", () => {
    const insights = run([tx("expense", "food", 5000), tx("expense", "Food", 4200), tx("income", "Salary", 50000)], {
      budgets: [{ category: "Food", amount: 8000 }],
    });
    expect(insights[0]).toMatchObject({ id: "over-budget-food", tone: "warning" });
    expect(insights[0].message).toBe("You went **₹1,200 over** your **Food** budget.");
  });

  it("warns when a budget is nearly used up, only while the month is running", () => {
    const current = [tx("expense", "Shopping", 4600), tx("income", "Salary", 50000), tx("expense", "Rent", 100)];
    const budgets = [{ category: "Shopping", amount: 5000 }];
    const running = run(current, { budgets, now: midMonth });
    expect(running.find((i) => i.id === "near-budget-shopping")?.message).toBe(
      "**Shopping** is at **92%** of its budget with **10 days** to go."
    );
    expect(ids(run(current, { budgets }))).not.toContain("near-budget-shopping");
  });

  it("flags spending more than was earned and links to Learn", () => {
    const insights = run([tx("income", "Salary", 20000), tx("expense", "Rent", 15000), tx("expense", "Food", 8000)]);
    expect(insights.find((i) => i.id === "spent-more-than-earned")).toMatchObject({
      message: "You spent **₹3,000 more** than you earned this month.",
      learnSlug: "budget",
    });
  });

  it("compares the savings rate with last month", () => {
    const insights = run([tx("income", "Salary", 50000), tx("expense", "Rent", 20000), tx("expense", "Food", 17000)], {
      previous: [tx("income", "Salary", 50000), tx("expense", "Rent", 41000)],
    });
    expect(insights.find((i) => i.id === "savings-rate-change")?.message).toBe(
      "Nice: you saved **26%** of your income, up from 18% in August."
    );
  });

  it("keeps good savings news for finished months", () => {
    // On day 20 the salary is in but some spending hasn't happened yet, so a higher rate isn't real yet
    const current = [tx("income", "Salary", 50000), tx("expense", "Rent", 15000), tx("expense", "Food", 5000)];
    const previous = [tx("income", "Salary", 50000), tx("expense", "Rent", 41000)];
    const running = ids(run(current, { previous, now: midMonth }));
    expect(running).not.toContain("savings-rate-change");
    expect(running).not.toContain("savings-rate");
    expect(ids(run(current, { previous }))).toContain("savings-rate-change");
  });

  it("still warns mid-month when saving is already lower than last month", () => {
    const current = [tx("income", "Salary", 50000), tx("expense", "Rent", 30000), tx("expense", "Food", 5000)];
    const previous = [tx("income", "Salary", 50000), tx("expense", "Rent", 20000)];
    expect(run(current, { previous, now: midMonth }).find((i) => i.id === "savings-rate-change")?.message).toBe(
      "You have saved **30%** of your income, down from 60% in August."
    );
  });

  it("only mentions category changes of at least 20% and ₹500", () => {
    const previous = [tx("expense", "Food", 4000), tx("expense", "Travel", 1000), tx("expense", "Fuel", 5000)];
    const small = run([tx("expense", "Food", 4700), tx("expense", "Travel", 1400), tx("expense", "Fuel", 5400)], { previous });
    expect(ids(small)).not.toContain("category-up"); // +17.5%, +₹400 and +8%: all too small

    const big = run([tx("expense", "Food", 5200), tx("expense", "Travel", 1000), tx("expense", "Fuel", 5000)], { previous });
    expect(big.find((i) => i.id === "category-up")?.message).toBe(
      "You spent **30% more on Food** than in August (₹5,200 vs ₹4,000)."
    );
  });

  it("does not call a category 'down' while the month is still running", () => {
    const previous = [tx("expense", "Shopping", 6000), tx("expense", "Rent", 10000)];
    const current = [tx("expense", "Shopping", 1000), tx("expense", "Rent", 10000), tx("income", "Salary", 30000)];
    expect(ids(run(current, { previous, now: midMonth }))).not.toContain("category-down");
    expect(run(current, { previous }).find((i) => i.id === "category-down")?.message).toBe(
      "Nice: **Shopping** was **down 83%** from August (₹1,000 vs ₹6,000)."
    );
  });

  it("projects the month's spending from the pace so far", () => {
    const insights = run([tx("expense", "Rent", 15000), tx("expense", "Food", 5000), tx("income", "Salary", 60000)], {
      previous: [tx("expense", "Rent", 15000), tx("expense", "Food", 10000)],
      now: midMonth,
    });
    // ₹20,000 after 2/3 of the month projects to ₹30,000, which is ₹5,000 more than August's ₹25,000
    expect(insights.find((i) => i.id === "pace")?.message).toBe(
      "At this pace you'll spend about **₹30,000** this month, ₹5,000 more than August."
    );
  });

  it("returns at most four insights, most important first", () => {
    const insights = run(
      [tx("expense", "Food", 9000), tx("expense", "Shopping", 9000), tx("expense", "Rent", 20000), tx("income", "Salary", 30000)],
      {
        previous: [tx("expense", "Food", 2000), tx("income", "Salary", 30000)],
        budgets: [{ category: "Food", amount: 5000 }, { category: "Shopping", amount: 5000 }],
      }
    );
    expect(insights).toHaveLength(4);
    expect(insights[0].id).toMatch(/^over-budget/);
    expect(ids(insights)).toContain("spent-more-than-earned");
  });
});

describe("GET /api/transactions/insights", () => {
  it("validates the dates and returns insights for the month", async () => {
    await resetDatabase();
    const user = await createUser("insight");
    await api().get("/api/transactions/insights?from=2026-09-01&to=2026-08-01&prevFrom=2026-07-01").set("Authorization", user.auth).expect(400);
    const res = await api()
      .get("/api/transactions/insights?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z&prevFrom=2026-08-01T00:00:00Z&tzOffset=0")
      .set("Authorization", user.auth)
      .expect(200);
    expect(ids(res.body.insights)).toEqual(["not-enough-data"]);
  });
});

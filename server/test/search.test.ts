import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const add = (auth: string, body: Record<string, unknown>) =>
  api().post("/api/transactions").set("Authorization", auth).send(body).expect(201);

const search = (user: User, query: Record<string, string | number>) =>
  api().get("/api/transactions/search").set("Authorization", user.auth).query(query);

describe("transaction search", () => {
  let user: User;

  beforeAll(async () => {
    user = await createUser("search");
    await add(user.auth, { amount: 250, type: "expense", category: "Food", note: "Swiggy dinner", date: "2026-01-10T12:00:00Z" });
    await add(user.auth, { amount: 400, type: "expense", category: "Food", note: "swiggy lunch", date: "2026-03-05T12:00:00Z" });
    await add(user.auth, { amount: 1200, type: "expense", category: "Transport", note: "Train", date: "2026-03-06T12:00:00Z" });
    await add(user.auth, { amount: 50000, type: "income", category: "Salary", date: "2026-03-01T12:00:00Z" });
  });

  it("matches notes and categories ignoring case, with totals for every match", async () => {
    const res = await search(user, { q: "SWIGGY" }).expect(200);
    expect(res.body.transactions.map((t: { note: string }) => t.note)).toEqual(["swiggy lunch", "Swiggy dinner"]);
    expect(res.body.totals).toEqual({ count: 2, income: 0, expense: 650 });

    const byCategory = await search(user, { q: "transp" }).expect(200);
    expect(byCategory.body.totals.count).toBe(1);
  });

  it("combines type, category, amount and date filters", async () => {
    const res = await search(user, {
      type: "expense",
      category: "Food",
      min: 300,
      from: "2026-03-01T00:00:00Z",
      to: "2026-04-01T00:00:00Z",
    }).expect(200);
    expect(res.body.totals).toEqual({ count: 1, income: 0, expense: 400 });

    const income = await search(user, { type: "income", max: 60000 }).expect(200);
    expect(income.body.totals).toEqual({ count: 1, income: 50000, expense: 0 });
  });

  it("pages through results without repeating or skipping any", async () => {
    const many = await createUser("paging");
    for (let i = 0; i < 55; i++) {
      await add(many.auth, { amount: i + 1, type: "expense", category: "Misc", date: new Date(Date.UTC(2026, 0, 1, 12, i)).toISOString() });
    }
    const first = await search(many, {}).expect(200);
    expect(first.body.transactions).toHaveLength(50);
    expect(first.body.totals.count).toBe(55);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await search(many, { cursor: first.body.nextCursor }).expect(200);
    expect(second.body.transactions).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();
    const ids = new Set([...first.body.transactions, ...second.body.transactions].map((t: { id: string }) => t.id));
    expect(ids.size).toBe(55);
  });

  it("never returns another user's transactions or categories", async () => {
    const other = await createUser("other");
    const res = await search(other, { q: "swiggy" }).expect(200);
    expect(res.body.totals.count).toBe(0);
    const categories = await api().get("/api/transactions/categories").set("Authorization", other.auth).expect(200);
    expect(categories.body.categories).toEqual([]);
  });

  it("lists every category the user has used", async () => {
    const res = await api().get("/api/transactions/categories").set("Authorization", user.auth).expect(200);
    expect(res.body.categories).toEqual(["Food", "Salary", "Transport"]);
  });

  it("rejects invalid filters", async () => {
    await search(user, { type: "gift" }).expect(400);
    await search(user, { min: -5 }).expect(400);
    await search(user, { min: 500, max: 100 }).expect(400);
    await search(user, { q: "x".repeat(101) }).expect(400);
    await search(user, { from: "not-a-date" }).expect(400);
    await api().get("/api/transactions/search").expect(401);
  });
});

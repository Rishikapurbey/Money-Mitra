import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;
interface Category {
  id: string;
  name: string;
  type: string;
  transactions: number;
  recurring: number;
  hasBudget: boolean;
}

const list = async (user: User): Promise<Category[]> =>
  (await api().get("/api/categories").set("Authorization", user.auth).expect(200)).body.categories;
const find = async (user: User, name: string, type = "expense") => {
  const found = (await list(user)).find((c) => c.name === name && c.type === type);
  if (!found) throw new Error(`No ${type} category ${name}`);
  return found;
};
const addTransaction = (user: User, body: Record<string, unknown>) =>
  api().post("/api/transactions").set("Authorization", user.auth).send(body).expect(201);
const transactionCategories = async (user: User) =>
  (await api().get("/api/transactions").set("Authorization", user.auth).expect(200)).body.transactions.map(
    (t: { category: string }) => t.category
  );

describe("categories", () => {
  it("gives new accounts the starter set", async () => {
    const user = await createUser("starter");
    const names = (await list(user)).map((c) => `${c.type}:${c.name}`);
    expect(names).toContain("expense:Food");
    expect(names).toContain("income:Salary");
    expect(names).toHaveLength(9);
  });

  it("adds a new category typed in with a transaction, budget or recurring entry, ignoring capitalisation", async () => {
    const user = await createUser("remember");
    await addTransaction(user, { amount: 120, type: "expense", category: "Chai" });
    await addTransaction(user, { amount: 80, type: "expense", category: "chai" });
    await addTransaction(user, { amount: 500, type: "expense", category: "food" });
    await api().put("/api/budgets").set("Authorization", user.auth).send({ category: "Petrol", amount: 3000 }).expect(200);

    const categories = await list(user);
    expect(categories.filter((c) => c.name.toLowerCase() === "chai")).toHaveLength(1);
    expect(categories.filter((c) => c.name.toLowerCase() === "food")).toHaveLength(1);
    expect(categories.find((c) => c.name === "Petrol")?.hasBudget).toBe(true);
    // Typing "chai" when "Chai" exists (or "food" when the starter "Food" does) uses the existing spelling
    expect((await find(user, "Chai")).transactions).toBe(2);
    expect((await transactionCategories(user)).sort()).toEqual(["Chai", "Chai", "Food"]);
  });

  it("treats older entries in other capitalisations as the same category, and lists names missing from it", async () => {
    const user = await createUser("legacy");
    const userId = (await prisma.user.findFirstOrThrow({ where: { email: user.email } })).id;
    // As if saved before categories existed, or while an older version was running
    await prisma.transaction.createMany({
      data: [
        { userId, amount: 100, type: "expense", category: "food" },
        { userId, amount: 200, type: "expense", category: "Parents" },
      ],
    });
    await prisma.budget.create({ data: { userId, category: "FOOD", amount: 3000 } });

    expect(await find(user, "Food")).toMatchObject({ transactions: 1, hasBudget: true });
    expect((await find(user, "Parents")).transactions).toBe(1);

    const food = await find(user, "Food");
    await api().delete(`/api/categories/${food.id}`).set("Authorization", user.auth).expect(409);
    await api().patch(`/api/categories/${food.id}`).set("Authorization", user.auth).send({ name: "Groceries" }).expect(200);
    expect((await transactionCategories(user)).sort()).toEqual(["Groceries", "Parents"]);
    const budgets = (await api().get("/api/budgets").set("Authorization", user.auth).expect(200)).body.budgets;
    expect(budgets.map((b: { category: string }) => b.category)).toEqual(["Groceries"]);
  });

  it("creates categories and refuses duplicates in any capitalisation", async () => {
    const user = await createUser("create");
    await api().post("/api/categories").set("Authorization", user.auth).send({ name: "Parents", type: "expense" }).expect(201);
    await api().post("/api/categories").set("Authorization", user.auth).send({ name: "PARENTS", type: "expense" }).expect(409);
    // The same name is fine as an income category
    await api().post("/api/categories").set("Authorization", user.auth).send({ name: "Parents", type: "income" }).expect(201);
    await api().post("/api/categories").set("Authorization", user.auth).send({ name: " ", type: "expense" }).expect(400);
    await api().post("/api/categories").set("Authorization", user.auth).send({ name: "Gift", type: "loan" }).expect(400);
  });

  it("renames past transactions, recurring entries and budgets along with the category", async () => {
    const user = await createUser("rename");
    await addTransaction(user, { amount: 300, type: "expense", category: "Food" });
    await addTransaction(user, { amount: 50000, type: "income", category: "Food" }); // an income one with the same name stays
    await api().put("/api/budgets").set("Authorization", user.auth).send({ category: "Food", amount: 5000 }).expect(200);
    await api()
      .post("/api/recurring")
      .set("Authorization", user.auth)
      .send({ amount: 999, type: "expense", category: "Food", dayOfMonth: 5, tzOffset: -330 })
      .expect(201);

    const food = await find(user, "Food");
    await api().patch(`/api/categories/${food.id}`).set("Authorization", user.auth).send({ name: "Eating out" }).expect(200);

    expect((await transactionCategories(user)).sort()).toEqual(["Eating out", "Food"]);
    const renamed = await find(user, "Eating out");
    expect(renamed).toMatchObject({ transactions: 1, recurring: 1, hasBudget: true });
    const budgets = (await api().get("/api/budgets").set("Authorization", user.auth).expect(200)).body.budgets;
    expect(budgets.map((b: { category: string }) => b.category)).toEqual(["Eating out"]);
  });

  it("allows fixing capitalisation, but not renaming onto another category", async () => {
    const user = await createUser("clash");
    await addTransaction(user, { amount: 100, type: "expense", category: "groceries" });
    const groceries = await find(user, "groceries");
    await api().patch(`/api/categories/${groceries.id}`).set("Authorization", user.auth).send({ name: "Groceries" }).expect(200);
    expect(await transactionCategories(user)).toEqual(["Groceries"]);

    const res = await api().patch(`/api/categories/${groceries.id}`).set("Authorization", user.auth).send({ name: "FOOD" }).expect(409);
    expect(res.body.error).toContain("Merge");
  });

  it("merges one category into another, keeping the target's budget", async () => {
    const user = await createUser("merge");
    await addTransaction(user, { amount: 100, type: "expense", category: "Swiggy" });
    await addTransaction(user, { amount: 200, type: "expense", category: "Food" });
    await api().put("/api/budgets").set("Authorization", user.auth).send({ category: "Swiggy", amount: 1000 }).expect(200);
    await api().put("/api/budgets").set("Authorization", user.auth).send({ category: "Food", amount: 4000 }).expect(200);

    const swiggy = await find(user, "Swiggy");
    const food = await find(user, "Food");
    await api().post(`/api/categories/${swiggy.id}/merge`).set("Authorization", user.auth).send({ intoId: food.id }).expect(200);

    expect(await transactionCategories(user)).toEqual(["Food", "Food"]);
    expect((await list(user)).some((c) => c.name === "Swiggy")).toBe(false);
    const budgets = (await api().get("/api/budgets").set("Authorization", user.auth).expect(200)).body.budgets;
    expect(budgets).toHaveLength(1);
    expect(budgets[0]).toMatchObject({ category: "Food", amount: 4000 });

    const salary = await find(user, "Salary", "income");
    await api().post(`/api/categories/${food.id}/merge`).set("Authorization", user.auth).send({ intoId: salary.id }).expect(400);
    await api().post(`/api/categories/${food.id}/merge`).set("Authorization", user.auth).send({ intoId: food.id }).expect(400);
  });

  it("deletes only categories nothing uses", async () => {
    const user = await createUser("delete");
    await addTransaction(user, { amount: 100, type: "expense", category: "Rent" });
    const rent = await find(user, "Rent");
    const res = await api().delete(`/api/categories/${rent.id}`).set("Authorization", user.auth).expect(409);
    expect(res.body.error).toBe("Rent is used by 1 transaction. Merge it into another category instead.");

    const health = await find(user, "Health");
    await api().delete(`/api/categories/${health.id}`).set("Authorization", user.auth).expect(200);
    expect((await list(user)).some((c) => c.name === "Health")).toBe(false);
  });

  it("never lets one user see or change another user's categories", async () => {
    const owner = await createUser("owner");
    const other = await createUser("intruder");
    const food = await find(owner, "Food");
    const otherFood = await find(other, "Food");
    await api().patch(`/api/categories/${food.id}`).set("Authorization", other.auth).send({ name: "Hacked" }).expect(404);
    await api().delete(`/api/categories/${food.id}`).set("Authorization", other.auth).expect(404);
    await api().post(`/api/categories/${otherFood.id}/merge`).set("Authorization", other.auth).send({ intoId: food.id }).expect(404);
    await api().get("/api/categories").expect(401);
    expect((await find(owner, "Food")).name).toBe("Food");
  });
});

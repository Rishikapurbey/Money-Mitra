import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

describe("users can only see and change their own data", () => {
  it("keeps transactions private", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const created = await api()
      .post("/api/transactions")
      .set("Authorization", owner.auth)
      .send({ amount: 250, type: "expense", category: "Food" })
      .expect(201);
    const id = created.body.transaction.id;

    const list = await api().get("/api/transactions").set("Authorization", other.auth).expect(200);
    expect(list.body.transactions).toHaveLength(0);
    await api().delete(`/api/transactions/${id}`).set("Authorization", other.auth).expect(404);
    await api()
      .put(`/api/transactions/${id}`)
      .set("Authorization", other.auth)
      .send({ amount: 1, type: "expense", category: "Food" })
      .expect(404);
    await api().delete(`/api/transactions/${id}`).set("Authorization", owner.auth).expect(200);
  });

  it("validates transaction input", async () => {
    const user = await createUser("valid");
    for (const body of [
      { amount: -5, type: "expense", category: "Food" },
      { amount: "abc", type: "expense", category: "Food" },
      { amount: 5, type: "gift", category: "Food" },
    ]) {
      await api().post("/api/transactions").set("Authorization", user.auth).send(body).expect(400);
    }
  });

  it("keeps budgets and goals private", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const budget = await api().put("/api/budgets").set("Authorization", owner.auth).send({ category: "Food", amount: 5000 }).expect(200);
    const goal = await api().post("/api/goals").set("Authorization", owner.auth).send({ name: "Trip", targetAmount: 10000 }).expect(201);

    expect((await api().get("/api/budgets").set("Authorization", other.auth)).body.budgets).toHaveLength(0);
    expect((await api().get("/api/goals").set("Authorization", other.auth)).body.goals).toHaveLength(0);
    await api().delete(`/api/budgets/${budget.body.budget.id}`).set("Authorization", other.auth).expect(404);
    await api().delete(`/api/goals/${goal.body.goal.id}`).set("Authorization", other.auth).expect(404);
    await api()
      .post(`/api/goals/${goal.body.goal.id}/contributions`)
      .set("Authorization", other.auth)
      .send({ amount: 100 })
      .expect(404);
  });
});

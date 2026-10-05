import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

describe("the Tracker summary", () => {
  it("says whether any income has been added, so a spending-only balance can be explained", async () => {
    const user = await createUser("summary");
    const summary = async () => (await api().get("/api/transactions/summary").set("Authorization", user.auth).expect(200)).body.summary;
    await api().post("/api/transactions").set("Authorization", user.auth).send({ type: "expense", amount: 250, category: "Food" }).expect(201);
    expect(await summary()).toMatchObject({ totalBalance: -250, hasIncome: false });
    await api().post("/api/transactions").set("Authorization", user.auth).send({ type: "income", amount: 1000, category: "Salary" }).expect(201);
    expect(await summary()).toMatchObject({ totalBalance: 750, hasIncome: true });
  });
});

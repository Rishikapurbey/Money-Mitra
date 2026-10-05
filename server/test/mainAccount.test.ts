import { beforeAll, describe, expect, it } from "vitest";
import { mainAccountAt, netWorthAt } from "../src/modules/networth/networth";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const v = (itemId: string, kind: string, value: number, iso: string) => ({ itemId, kind, value, recordedAt: new Date(iso) });
const flow = (iso: string, amount: number) => ({ date: new Date(iso), amount });

describe("mainAccountAt", () => {
  const values = [v("bank", "asset", 50000, "2026-10-01T00:00:00Z"), v("loan", "liability", 10000, "2026-10-01T00:00:00Z")];
  const main = {
    itemId: "bank",
    flows: [flow("2026-09-20T00:00:00Z", -999), flow("2026-10-03T00:00:00Z", -2000), flow("2026-10-05T00:00:00Z", 30000), flow("2026-10-20T00:00:00Z", -500)],
  };

  it("adds income and takes away expenses dated after the last typed-in value", () => {
    // September's expense was already part of the ₹50,000 typed in on 1 October
    expect(mainAccountAt(values, main, new Date("2026-10-10T00:00:00Z"))).toEqual({
      recorded: 50000,
      recordedAt: new Date("2026-10-01T00:00:00Z"),
      change: 28000,
      value: 78000,
    });
    expect(netWorthAt(values, new Date("2026-10-10T00:00:00Z"), main)).toEqual({ assets: 78000, liabilities: 10000, netWorth: 68000 });
    // Net worth on an earlier day only counts what happened by then
    expect(netWorthAt(values, new Date("2026-10-04T00:00:00Z"), main)?.netWorth).toBe(38000);
  });

  it("starts again from a newly typed-in value", () => {
    const later = [...values, v("bank", "asset", 77000, "2026-10-15T00:00:00Z")];
    expect(mainAccountAt(later, main, new Date("2026-10-25T00:00:00Z"))?.value).toBe(76500);
  });

  it("is unknown before its first value", () => {
    expect(mainAccountAt(values, main, new Date("2026-09-25T00:00:00Z"))).toBeNull();
  });
});

describe("the main account in the app", () => {
  const add = (user: User, body: Record<string, unknown>) =>
    api().post("/api/networth/items").set("Authorization", user.auth).send(body).expect(201);
  const overview = async (user: User) => (await api().get("/api/networth").set("Authorization", user.auth).expect(200)).body;
  const transact = (user: User, type: string, amount: number) =>
    api().post("/api/transactions").set("Authorization", user.auth).send({ type, amount, category: type === "income" ? "Salary" : "Food" }).expect(201);

  it("moves with Tracker income and expenses, including edits and deletes", async () => {
    const user = await createUser("main");
    const bank = (await add(user, { kind: "asset", type: "bank", name: "HDFC", value: 50000 })).body.item;
    await add(user, { kind: "asset", type: "gold", name: "Gold", value: 20000 });
    await api().put(`/api/networth/items/${bank.id}/main`).set("Authorization", user.auth).send({ isMain: true }).expect(200);

    await transact(user, "income", 30000);
    const spent = (await transact(user, "expense", 2000)).body.transaction;
    let data = await overview(user);
    expect(data.items.find((i: { id: string }) => i.id === bank.id)).toMatchObject({ isMain: true, value: 78000, tracked: { recorded: 50000, change: 28000 } });
    expect(data.totals).toEqual({ assets: 98000, liabilities: 0, netWorth: 98000 });

    await api().put(`/api/transactions/${spent.id}`).set("Authorization", user.auth).send({ ...spent, amount: 500 }).expect(200);
    await api().delete(`/api/transactions/${spent.id}`).set("Authorization", user.auth).expect(200);
    data = await overview(user);
    expect(data.totals.netWorth).toBe(100000);

    // Typing in the real balance becomes the new starting point
    await api().post(`/api/networth/items/${bank.id}/values`).set("Authorization", user.auth).send({ value: 79000 }).expect(200);
    expect((await overview(user)).items.find((i: { id: string }) => i.id === bank.id)).toMatchObject({ value: 79000, tracked: { change: 0 } });
  });

  it("ignores transactions dated before the last typed-in value", async () => {
    const user = await createUser("main_old");
    const bank = (await add(user, { kind: "asset", type: "bank", name: "SBI", value: 10000 })).body.item;
    await api().put(`/api/networth/items/${bank.id}/main`).set("Authorization", user.auth).send({ isMain: true }).expect(200);
    await api()
      .post("/api/transactions")
      .set("Authorization", user.auth)
      .send({ type: "expense", amount: 700, category: "Food", date: "2026-01-15T12:00:00.000Z" })
      .expect(201);
    expect((await overview(user)).totals.netWorth).toBe(10000);
  });

  it("allows one main account, only a bank account or cash, and lets go when removed", async () => {
    const user = await createUser("main_rules");
    const a = (await add(user, { kind: "asset", type: "bank", name: "A", value: 100 })).body.item;
    const b = (await add(user, { kind: "asset", type: "cash", name: "Wallet", value: 100 })).body.item;
    const gold = (await add(user, { kind: "asset", type: "gold", name: "Gold", value: 100 })).body.item;
    const setMain = (id: string, isMain = true) => api().put(`/api/networth/items/${id}/main`).set("Authorization", user.auth).send({ isMain });

    await setMain(gold.id).expect(400);
    await setMain(a.id).expect(200);
    await setMain(b.id).expect(200);
    expect((await overview(user)).items.filter((i: { isMain: boolean }) => i.isMain).map((i: { id: string }) => i.id)).toEqual([b.id]);

    // Changing it to a type that can't be the main account stops it being one
    await api().put(`/api/networth/items/${b.id}`).set("Authorization", user.auth).send({ kind: "asset", type: "gold", name: "Wallet" }).expect(200);
    expect((await prisma.netWorthItem.findUniqueOrThrow({ where: { id: b.id } })).isMain).toBe(false);

    await setMain(a.id).expect(200);
    await api().delete(`/api/networth/items/${a.id}`).set("Authorization", user.auth).expect(200);
    expect((await prisma.netWorthItem.findUniqueOrThrow({ where: { id: a.id } })).isMain).toBe(false);

    const other = await createUser("main_other");
    await api().put(`/api/networth/items/${gold.id}/main`).set("Authorization", other.auth).send({ isMain: true }).expect(404);
  });
});

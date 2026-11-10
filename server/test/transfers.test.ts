import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;
type Item = { id: string; value: number; creditLimit: number | null };

const add = async (user: User, body: Record<string, unknown>) =>
  (await api().post("/api/networth/items").set("Authorization", user.auth).send(body).expect(201)).body.item as Item;
const overview = async (user: User) => (await api().get("/api/networth").set("Authorization", user.auth).expect(200)).body;
const valueOf = async (user: User, id: string) => ((await overview(user)).items as Item[]).find((i) => i.id === id)!.value;
const transfer = (user: User, body: Record<string, unknown>) => api().post("/api/transfers").set("Authorization", user.auth).send(body);
const spend = (user: User, body: Record<string, unknown>) =>
  api().post("/api/transactions").set("Authorization", user.auth).send({ type: "expense", category: "Food", ...body });

describe("transfers between your own accounts", () => {
  it("moves money between accounts without changing net worth, spending or income", async () => {
    const user = await createUser("tr_move");
    const bank = await add(user, { kind: "asset", type: "bank", name: "HDFC", value: 10000 });
    const cash = await add(user, { kind: "asset", type: "cash", name: "Wallet", value: 0 });
    const card = await add(user, { kind: "liability", type: "credit_card", name: "Card", value: 3000 });
    const before = (await overview(user)).totals.netWorth;

    // An ATM withdrawal, then paying the card bill
    const atm = (await transfer(user, { fromId: bank.id, toId: cash.id, amount: 2000, note: "ATM" }).expect(201)).body;
    expect(atm.accountAlert).toBeNull();
    await transfer(user, { fromId: bank.id, toId: card.id, amount: 3000 }).expect(201);

    expect([await valueOf(user, bank.id), await valueOf(user, cash.id), await valueOf(user, card.id)]).toEqual([5000, 2000, 0]);
    expect((await overview(user)).totals.netWorth).toBe(before);
    const summary = (await api().get("/api/transactions/summary").set("Authorization", user.auth).expect(200)).body.summary;
    expect([summary.income, summary.expense]).toEqual([0, 0]);

    // Listed for the Tracker, and for one account only when asked
    const list = async (account?: string) =>
      (await api().get("/api/transfers").query(account ? { account } : {}).set("Authorization", user.auth).expect(200)).body.transfers;
    expect(await list()).toHaveLength(2);
    expect(await list(cash.id)).toEqual([expect.objectContaining({ id: atm.transfer.id, amount: 2000, note: "ATM", fromId: bank.id, toId: cash.id })]);

    // Editing and deleting move the balances back
    await api().put(`/api/transfers/${atm.transfer.id}`).set("Authorization", user.auth).send({ fromId: bank.id, toId: cash.id, amount: 500 }).expect(200);
    expect(await valueOf(user, cash.id)).toBe(500);
    await api().delete(`/api/transfers/${atm.transfer.id}`).set("Authorization", user.auth).expect(200);
    expect([await valueOf(user, bank.id), await valueOf(user, cash.id)]).toEqual([7000, 0]);
  });

  it("checks the accounts and amount", async () => {
    const user = await createUser("tr_check");
    const other = await createUser("tr_check_o");
    const bank = await add(user, { kind: "asset", type: "bank", name: "A", value: 0 });
    const gold = await add(user, { kind: "asset", type: "gold", name: "Gold", value: 0 });
    const theirs = await add(other, { kind: "asset", type: "bank", name: "B", value: 0 });
    const error = async (body: Record<string, unknown>) => (await transfer(user, body).expect(400)).body.error;

    expect(await error({ fromId: bank.id, toId: bank.id, amount: 5 })).toBe("Choose two different accounts");
    expect(await error({ fromId: bank.id, toId: gold.id, amount: 5 })).toBe("Choose one of your accounts");
    expect(await error({ fromId: bank.id, toId: theirs.id, amount: 5 })).toBe("Choose one of your accounts");
    expect(await error({ fromId: bank.id, amount: 5 })).toBe("Choose where the money comes from and where it goes");
    expect(await error({ fromId: bank.id, toId: theirs.id, amount: 0 })).toBe("Amount must be a positive number");

    const mine = (await add(user, { kind: "asset", type: "cash", name: "C", value: 0 })).id;
    const created = (await transfer(user, { fromId: bank.id, toId: mine, amount: 1 }).expect(201)).body.transfer;
    await api().delete(`/api/transfers/${created.id}`).set("Authorization", other.auth).expect(404);
  });
});

describe("account alerts", () => {
  it("says when spending or a transfer takes an account below zero", async () => {
    const user = await createUser("tr_over");
    const bank = await add(user, { kind: "asset", type: "bank", name: "HDFC", value: 1000 });
    const savings = await add(user, { kind: "asset", type: "bank", name: "Savings", value: 50000 });

    expect((await spend(user, { amount: 400 }).expect(201)).body.accountAlert).toBeNull();
    expect((await spend(user, { amount: 1600 }).expect(201)).body.accountAlert).toEqual({
      kind: "overdrawn",
      accountId: bank.id,
      name: "HDFC",
      value: -1000,
    });
    // "Move money" covers it from savings
    await transfer(user, { fromId: savings.id, toId: bank.id, amount: 1000 }).expect(201);
    expect(await valueOf(user, bank.id)).toBe(0);
    expect((await transfer(user, { fromId: bank.id, toId: savings.id, amount: 1 }).expect(201)).body.accountAlert).toMatchObject({ kind: "overdrawn", value: -1 });
  });

  it("warns as a credit card nears and passes its limit", async () => {
    const user = await createUser("tr_limit");
    const card = await add(user, { kind: "liability", type: "credit_card", name: "Card", value: 0, creditLimit: 10000, isDefault: true });
    expect(card.creditLimit).toBe(10000);

    expect((await spend(user, { amount: 7000 }).expect(201)).body.accountAlert).toBeNull();
    expect((await spend(user, { amount: 1500 }).expect(201)).body.accountAlert).toMatchObject({ kind: "near_limit", value: 8500, limit: 10000 });
    expect((await spend(user, { amount: 2000 }).expect(201)).body.accountAlert).toMatchObject({ kind: "over_limit", value: 10500 });

    // The limit can be changed or cleared; only cards keep one
    const put = (body: Record<string, unknown>) => api().put(`/api/networth/items/${card.id}`).set("Authorization", user.auth).send({ kind: "liability", name: "Card", ...body });
    await put({ type: "credit_card", creditLimit: -5 }).expect(400);
    await put({ type: "credit_card", creditLimit: 20000 }).expect(200);
    expect((await spend(user, { amount: 1 }).expect(201)).body.accountAlert).toBeNull();
    await put({ type: "credit_card" }).expect(200);
    expect(((await overview(user)).items as Item[])[0]!.creditLimit).toBe(20000);
    await put({ type: "personal_loan" }).expect(200);
    expect(((await overview(user)).items as Item[])[0]!.creditLimit).toBeNull();
  });
});

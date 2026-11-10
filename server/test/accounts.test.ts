import { beforeAll, describe, expect, it } from "vitest";
import { accountAt, flowAmount, netWorthAt } from "../src/modules/networth/networth";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;
type Item = { id: string; name: string; value: number; isDefault: boolean; isAccount: boolean; tracked: { recorded: number; change: number } | null };

const v = (itemId: string, kind: string, value: number, iso: string) => ({ itemId, kind, value, recordedAt: new Date(iso) });
const flow = (iso: string, amount: number) => ({ date: new Date(iso), amount });

describe("account balances", () => {
  const values = [v("bank", "asset", 50000, "2026-10-01T00:00:00Z"), v("card", "liability", 4000, "2026-10-01T00:00:00Z")];
  const flows = new Map([
    ["bank", [flow("2026-09-20T00:00:00Z", -999), flow("2026-10-03T00:00:00Z", -2000), flow("2026-10-05T00:00:00Z", 30000), flow("2026-10-20T00:00:00Z", -500)]],
    ["card", [flow("2026-10-04T00:00:00Z", 1500)]],
  ]);

  it("adds each account's entries dated after its last typed-in value", () => {
    // September's expense was already part of the ₹50,000 typed in on 1 October
    expect(accountAt(values, "bank", flows, new Date("2026-10-10T00:00:00Z"))).toEqual({
      recorded: 50000,
      recordedAt: new Date("2026-10-01T00:00:00Z"),
      change: 28000,
      value: 78000,
    });
    // ₹1,500 spent on the card is ₹1,500 more owed
    expect(netWorthAt(values, new Date("2026-10-10T00:00:00Z"), flows)).toEqual({ assets: 78000, liabilities: 5500, netWorth: 72500 });
    expect(netWorthAt(values, new Date("2026-10-03T12:00:00Z"), flows)?.netWorth).toBe(44000);
  });

  it("starts again from a newly typed-in value, and is unknown before the first", () => {
    const later = [...values, v("bank", "asset", 77000, "2026-10-15T00:00:00Z")];
    expect(accountAt(later, "bank", flows, new Date("2026-10-25T00:00:00Z"))?.value).toBe(76500);
    expect(accountAt(values, "bank", flows, new Date("2026-09-25T00:00:00Z"))).toBeNull();
  });

  it("moves bank and cash up with income, and a credit card up with spending", () => {
    expect([flowAmount("asset", "income", 10), flowAmount("asset", "expense", 10)]).toEqual([10, -10]);
    expect([flowAmount("liability", "expense", 10), flowAmount("liability", "income", 10)]).toEqual([10, -10]);
  });
});

describe("accounts in the app", () => {
  const add = async (user: User, body: Record<string, unknown>) =>
    (await api().post("/api/networth/items").set("Authorization", user.auth).send(body).expect(201)).body.item as Item;
  const overview = async (user: User) => (await api().get("/api/networth").set("Authorization", user.auth).expect(200)).body;
  const itemIn = async (user: User, id: string) => (await overview(user)).items.find((i: Item) => i.id === id) as Item;
  const transact = (user: User, body: Record<string, unknown>) =>
    api().post("/api/transactions").set("Authorization", user.auth).send({ category: body.type === "income" ? "Salary" : "Food", ...body });

  it("adds up salary, own spending and shared spending into net worth", async () => {
    const user = await createUser("acc_eg");
    const bank = await add(user, { kind: "asset", type: "bank", name: "HDFC", value: 20000 });
    await add(user, { kind: "asset", type: "gold", name: "Gold", value: 50000 });
    // The first account becomes the default, so entries without an account go to it
    expect(bank.isDefault).toBe(true);

    await transact(user, { type: "income", amount: 15000 }).expect(201);
    await transact(user, { type: "expense", amount: 10000 }).expect(201);
    const friend = await createUser("acc_eg_f");
    const groupId = (await api().post("/api/shared/groups").set("Authorization", friend.auth).send({ name: "Trip" }).expect(201)).body.group.id;
    const invite = (await api().post(`/api/shared/groups/${groupId}/members`).set("Authorization", friend.auth).send({ username: user.username }).expect(201)).body.member;
    await api().post(`/api/shared/invites/${invite.id}/accept`).set("Authorization", user.auth).expect(200);
    const members = (await api().get(`/api/shared/groups/${groupId}`).set("Authorization", user.auth).expect(200)).body.group.members as { id: string; isMe: boolean }[];
    const friendSpot = members.find((m) => !m.isMe)!.id;
    const mySpot = members.find((m) => m.isMe)!.id;
    await api()
      .post(`/api/shared/groups/${groupId}/expenses`)
      .set("Authorization", friend.auth)
      .send({ description: "Hotel", amount: 4000, category: "Travel", paidById: friendSpot, split: { type: "equal", memberIds: [friendSpot, mySpot] } })
      .expect(201);

    expect(await itemIn(user, bank.id)).toMatchObject({ isAccount: true, value: 23000, tracked: { recorded: 20000, change: 3000 } });
    expect((await overview(user)).totals.netWorth).toBe(73000);
  });

  it("keeps each account's balance separate, and moves a credit card the other way", async () => {
    const user = await createUser("acc_sep");
    const hdfc = await add(user, { kind: "asset", type: "bank", name: "HDFC", value: 1000 });
    const cash = await add(user, { kind: "asset", type: "cash", name: "Wallet", value: 500 });
    const card = await add(user, { kind: "liability", type: "credit_card", name: "Card", value: 0 });
    expect([cash.isDefault, card.isDefault]).toEqual([false, false]);

    await transact(user, { type: "expense", amount: 200, accountId: cash.id }).expect(201);
    await transact(user, { type: "expense", amount: 1500, accountId: hdfc.id }).expect(201);
    await transact(user, { type: "expense", amount: 900, accountId: card.id }).expect(201);
    await transact(user, { type: "income", amount: 100, accountId: card.id }).expect(201);
    const none = (await transact(user, { type: "expense", amount: 50, accountId: null }).expect(201)).body.transaction;
    expect(none.accountId).toBeNull();

    // Spending more than an account holds takes it below zero
    expect((await itemIn(user, hdfc.id)).value).toBe(-500);
    expect((await itemIn(user, cash.id)).value).toBe(300);
    expect((await itemIn(user, card.id)).value).toBe(800);
    expect((await overview(user)).totals).toEqual({ assets: -200, liabilities: 800, netWorth: -1000 });

    const accounts = (await api().get("/api/networth/accounts").set("Authorization", user.auth).expect(200)).body.accounts;
    expect(accounts.map((a: Item) => [a.name, a.value, a.isDefault])).toEqual([
      ["HDFC", -500, true],
      ["Wallet", 300, false],
      ["Card", 800, false],
    ]);

    const search = (account: string) =>
      api().get("/api/transactions/search").query({ account }).set("Authorization", user.auth).expect(200);
    expect((await search(cash.id)).body.totals).toEqual({ count: 1, income: 0, expense: 200 });
    expect((await search("none")).body.totals).toEqual({ count: 1, income: 0, expense: 50 });
  });

  it("moves entries between accounts when they're edited", async () => {
    const user = await createUser("acc_edit");
    const a = await add(user, { kind: "asset", type: "bank", name: "A", value: 1000 });
    const b = await add(user, { kind: "asset", type: "bank", name: "B", value: 1000 });
    const spent = (await transact(user, { type: "expense", amount: 300 }).expect(201)).body.transaction;
    expect(spent.accountId).toBe(a.id);

    await api().put(`/api/transactions/${spent.id}`).set("Authorization", user.auth).send({ ...spent, accountId: b.id }).expect(200);
    expect([(await itemIn(user, a.id)).value, (await itemIn(user, b.id)).value]).toEqual([1000, 700]);
    // Leaving the account out of an edit keeps it
    await api().put(`/api/transactions/${spent.id}`).set("Authorization", user.auth).send({ type: "expense", amount: 400, category: "Food" }).expect(200);
    expect((await itemIn(user, b.id)).value).toBe(600);
  });

  it("only accepts the user's own, current accounts", async () => {
    const user = await createUser("acc_check");
    const other = await createUser("acc_check_o");
    const theirs = await add(other, { kind: "asset", type: "bank", name: "Theirs", value: 1 });
    const gold = await add(user, { kind: "asset", type: "gold", name: "Gold", value: 1 });
    const old = await add(user, { kind: "asset", type: "bank", name: "Old", value: 1 });
    await api().delete(`/api/networth/items/${old.id}`).set("Authorization", user.auth).expect(200);

    for (const accountId of [theirs.id, gold.id, old.id, "nope"]) {
      expect((await transact(user, { type: "expense", amount: 1, accountId }).expect(400)).body.error).toBe("Choose one of your accounts");
    }
  });

  it("has one default account: a bank account, cash or a card", async () => {
    const user = await createUser("acc_default");
    const a = await add(user, { kind: "asset", type: "bank", name: "A", value: 100 });
    const card = await add(user, { kind: "liability", type: "credit_card", name: "Card", value: 0 });
    const gold = await add(user, { kind: "asset", type: "gold", name: "Gold", value: 100 });
    const setDefault = (id: string, isDefault = true) =>
      api().put(`/api/networth/items/${id}/default`).set("Authorization", user.auth).send({ isDefault });
    const defaults = async () => (await overview(user)).items.filter((i: Item) => i.isDefault).map((i: Item) => i.id);

    expect(await defaults()).toEqual([a.id]);
    await setDefault(gold.id).expect(400);
    await setDefault(card.id).expect(200);
    expect(await defaults()).toEqual([card.id]);
    // Adding an account can make it the default straight away
    const b = await add(user, { kind: "asset", type: "cash", name: "Wallet", value: 0, isDefault: true });
    expect(await defaults()).toEqual([b.id]);

    // Changing it to a type that isn't an account stops it being the default
    await api().put(`/api/networth/items/${b.id}`).set("Authorization", user.auth).send({ kind: "asset", type: "gold", name: "Wallet" }).expect(200);
    expect(await defaults()).toEqual([]);
    // With no default, entries are saved without an account
    expect((await transact(user, { type: "expense", amount: 5 }).expect(201)).body.transaction.accountId).toBeNull();

    await setDefault(a.id).expect(200);
    await api().delete(`/api/networth/items/${a.id}`).set("Authorization", user.auth).expect(200);
    expect((await prisma.netWorthItem.findUniqueOrThrow({ where: { id: a.id } })).isDefault).toBe(false);

    const other = await createUser("accdef_o");
    await api().put(`/api/networth/items/${card.id}/default`).set("Authorization", other.auth).send({ isDefault: true }).expect(404);
  });

  it("puts recurring entries and imported files in their chosen account", async () => {
    const user = await createUser("acc_rec");
    await add(user, { kind: "asset", type: "bank", name: "Main", value: 0 });
    const salary = await add(user, { kind: "asset", type: "bank", name: "Salary", value: 0 });
    const rule = (
      await api()
        .post("/api/recurring")
        .set("Authorization", user.auth)
        .send({ amount: 5000, type: "income", category: "Salary", dayOfMonth: 1, tzOffset: -330, accountId: salary.id })
        .expect(201)
    ).body.recurring;
    expect(rule.accountId).toBe(salary.id);
    // Entries are only counted after an account's typed-in value, so start the balance a year back
    await prisma.netWorthValue.updateMany({ where: { itemId: salary.id }, data: { recordedAt: new Date(Date.now() - 365 * 86_400_000) } });
    await prisma.recurringTransaction.update({ where: { id: rule.id }, data: { nextDue: new Date(Date.now() - 60_000) } });
    await api().post("/api/recurring/run").set("Authorization", user.auth).expect(200);
    expect((await prisma.transaction.findFirstOrThrow({ where: { recurringId: rule.id } })).accountId).toBe(salary.id);

    const rows = [{ amount: 120, type: "expense", category: "Food", date: new Date(Date.now() - 60_000).toISOString() }];
    const created = (await api().post("/api/imports").set("Authorization", user.auth).send({ fileName: "s.csv", rows, accountId: salary.id }).expect(201)).body.import;
    expect((await prisma.transaction.findFirstOrThrow({ where: { importId: created.id } })).accountId).toBe(salary.id);
    expect((await itemIn(user, salary.id)).value).toBe(4880);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;
type Member = { id: string; name: string; isMe: boolean; balance: number; status: string };

const groupOf = async (user: User, id: string) => (await api().get(`/api/shared/groups/${id}`).set("Authorization", user.auth).expect(200)).body.group;
const trackerOf = async (user: User) => (await api().get("/api/transactions").set("Authorization", user.auth).expect(200)).body.transactions;
const inboxOf = async (user: User) => (await api().get("/api/notifications").set("Authorization", user.auth).expect(200)).body.notifications;

// A group of `owner`, a friend on Money Mitra and "Ravi" added by name
async function setUp(prefix: string) {
  const owner = await createUser(`${prefix}_a`);
  const friend = await createUser(`${prefix}_b`);
  const id = (await api().post("/api/shared/groups").set("Authorization", owner.auth).send({ name: "Goa" }).expect(201)).body.group.id;
  const invite = (await api().post(`/api/shared/groups/${id}/members`).set("Authorization", owner.auth).send({ username: friend.username }).expect(201)).body.member;
  await api().post(`/api/shared/invites/${invite.id}/accept`).set("Authorization", friend.auth).expect(200);
  await api().post(`/api/shared/groups/${id}/members`).set("Authorization", owner.auth).send({ name: "Ravi" }).expect(201);
  const members: Member[] = (await groupOf(owner, id)).members;
  const [a, b, ravi] = members.map((m) => m.id) as [string, string, string];
  return { owner, friend, id, a, b, ravi };
}

const addExpense = (user: User, groupId: string, body: Record<string, unknown>) =>
  api().post(`/api/shared/groups/${groupId}/expenses`).set("Authorization", user.auth).send({ category: "Food", ...body });
const balanceOf = (group: { members: Member[] }, memberId: string) => group.members.find((m) => m.id === memberId)?.balance;

describe("adding expenses", () => {
  it("splits equally, credits the payer and suggests who pays whom", async () => {
    const { owner, friend, id, a, b, ravi } = await setUp("eq");
    const res = await addExpense(owner, id, { description: "Dinner", amount: 1000, paidById: a, split: { type: "equal", memberIds: [a, b, ravi] } }).expect(201);
    expect(res.body.id).toBeTruthy();

    const group = await groupOf(friend, id);
    expect(group.expenses[0]).toMatchObject({ description: "Dinner", amount: 1000, category: "Food", paidById: a });
    expect(group.expenses[0].shares).toEqual([
      { memberId: a, amount: 333.34 },
      { memberId: b, amount: 333.33 },
      { memberId: ravi, amount: 333.33 },
    ]);
    expect([balanceOf(group, a), balanceOf(group, b), balanceOf(group, ravi)]).toEqual([666.66, -333.33, -333.33]);
    expect(group.suggestedPayments).toEqual([
      { fromMemberId: b, toMemberId: a, amount: 333.33 },
      { fromMemberId: ravi, toMemberId: a, amount: 333.33 },
    ]);
    expect(group.activity[0].message).toBe(`${owner.username} added Dinner (₹1,000)`);
  });

  it("puts each person's share in their own Tracker, whoever paid", async () => {
    const { owner, friend, id, b, ravi } = await setUp("trk");
    await addExpense(owner, id, { description: "Cab", amount: 600, paidById: ravi, split: { type: "exact", shares: [{ memberId: b, amount: 450 }, { memberId: ravi, amount: 150 }] } }).expect(201);

    expect(await trackerOf(owner)).toEqual([]);
    const [entry] = await trackerOf(friend);
    expect(entry).toMatchObject({ amount: 450, type: "expense", category: "Food", note: "Cab (Goa)", shareId: expect.any(String) });
  });

  it("checks the split", async () => {
    const { owner, id, a, b } = await setUp("chk");
    const outsider = await createUser("chk_out");
    await addExpense(owner, id, { description: "X", amount: 100, paidById: a, split: { type: "exact", shares: [{ memberId: a, amount: 50 }, { memberId: b, amount: 40 }] } })
      .expect(400)
      .then((r) => expect(r.body.error).toBe("The shares add up to ₹90, not ₹100"));
    await addExpense(owner, id, { description: "X", amount: 100, paidById: a, split: { type: "equal", memberIds: [] } }).expect(400);
    await addExpense(owner, id, { description: "X", amount: 100, paidById: "nobody", split: { type: "equal", memberIds: [a] } }).expect(400);
    await addExpense(owner, id, { description: "X", amount: 100, paidById: a, split: { type: "equal", memberIds: [a, "nobody"] } }).expect(400);
    await addExpense(owner, id, { description: "X", amount: -5, paidById: a, split: { type: "equal", memberIds: [a] } }).expect(400);
    await addExpense(owner, id, { description: "", amount: 5, paidById: a, split: { type: "equal", memberIds: [a] } }).expect(400);
    await addExpense(outsider, id, { description: "X", amount: 5, paidById: a, split: { type: "equal", memberIds: [a] } }).expect(404);
  });

  it("won't take expenses in an archived group, or split with someone only invited", async () => {
    const { owner, id, a } = await setUp("arc");
    const invitee = await createUser("arc_inv");
    const pending = (await api().post(`/api/shared/groups/${id}/members`).set("Authorization", owner.auth).send({ username: invitee.username })).body.member;
    await addExpense(owner, id, { description: "X", amount: 5, paidById: a, split: { type: "equal", memberIds: [a, pending.id] } }).expect(400);

    await api().put(`/api/shared/groups/${id}/archive`).set("Authorization", owner.auth).send({ archived: true }).expect(200);
    await addExpense(owner, id, { description: "X", amount: 5, paidById: a, split: { type: "equal", memberIds: [a] } }).expect(400);
  });
});

describe("editing and deleting", () => {
  it("lets any member change an expense, keeps Trackers in step and logs what changed", async () => {
    const { owner, friend, id, a, b, ravi } = await setUp("edit");
    const { id: expenseId } = (await addExpense(owner, id, { description: "Dinner", amount: 1200, paidById: a, split: { type: "equal", memberIds: [a, b, ravi] } }).expect(201)).body;

    await api()
      .put(`/api/shared/groups/${id}/expenses/${expenseId}`)
      .set("Authorization", friend.auth)
      .send({ description: "Dinner", amount: 1000, category: "Food", paidById: a, split: { type: "equal", memberIds: [a, ravi] } })
      .expect(200);

    // The friend is no longer in it, so their share leaves their Tracker; the owner's is updated
    expect(await trackerOf(friend)).toEqual([]);
    expect((await trackerOf(owner))[0].amount).toBe(500);
    const group = await groupOf(owner, id);
    expect(group.activity[0].message).toBe(`${friend.username} changed Dinner: amount ₹1,200 → ₹1,000, split`);
    expect(balanceOf(group, b)).toBe(0);

    await api().delete(`/api/shared/groups/${id}/expenses/${expenseId}`).set("Authorization", friend.auth).expect(200);
    expect(await trackerOf(owner)).toEqual([]);
    expect((await groupOf(owner, id)).expenses).toEqual([]);
  });

  it("keeps a member's own category in their Tracker unless the group changes it", async () => {
    const { owner, friend, id, a, b } = await setUp("cat");
    const { id: expenseId } = (await addExpense(owner, id, { description: "Snacks", amount: 200, paidById: a, split: { type: "equal", memberIds: [a, b] } }).expect(201)).body;
    const [entry] = await trackerOf(friend);
    await api().put(`/api/transactions/${entry.id}`).set("Authorization", friend.auth).send({ ...entry, category: "Travel" }).expect(200);

    const send = (body: Record<string, unknown>) =>
      api()
        .put(`/api/shared/groups/${id}/expenses/${expenseId}`)
        .set("Authorization", owner.auth)
        .send({ description: "Snacks", amount: 200, category: "Food", paidById: a, split: { type: "equal", memberIds: [a, b] }, ...body })
        .expect(200);
    await send({ description: "Evening snacks" });
    expect((await trackerOf(friend))[0]).toMatchObject({ category: "Travel", note: "Evening snacks (Goa)" });
    await send({ description: "Evening snacks", category: "Shopping" });
    expect((await trackerOf(friend))[0].category).toBe("Shopping");
  });

  it("only lets the Tracker change a share's category and note", async () => {
    const { owner, id, a } = await setUp("lock");
    await addExpense(owner, id, { description: "Fuel", amount: 300, paidById: a, split: { type: "equal", memberIds: [a] } }).expect(201);
    const [entry] = await trackerOf(owner);
    await api().put(`/api/transactions/${entry.id}`).set("Authorization", owner.auth).send({ ...entry, amount: 1, type: "income", note: "Petrol" }).expect(200);
    expect((await trackerOf(owner))[0]).toMatchObject({ amount: 300, type: "expense", note: "Petrol" });
    await api().delete(`/api/transactions/${entry.id}`).set("Authorization", owner.auth).expect(400);
  });
});

describe("settling up", () => {
  it("records paybacks without touching anyone's Tracker, and can undo them", async () => {
    const { owner, friend, id, a, b } = await setUp("set");
    await addExpense(owner, id, { description: "Hotel", amount: 4000, paidById: a, split: { type: "equal", memberIds: [a, b] } }).expect(201);
    const before = (await trackerOf(friend)).length;

    const { id: settlementId } = (
      await api().post(`/api/shared/groups/${id}/settlements`).set("Authorization", friend.auth).send({ fromMemberId: b, toMemberId: a, amount: 2000 }).expect(201)
    ).body;
    let group = await groupOf(owner, id);
    expect(balanceOf(group, a)).toBe(0);
    expect(group.suggestedPayments).toEqual([]);
    expect(group.settlements[0]).toMatchObject({ fromMemberId: b, toMemberId: a, amount: 2000 });
    expect(group.activity[0].message).toBe(`${friend.username} recorded that ${friend.username} paid ${owner.username} ₹2,000`);
    expect(await trackerOf(friend)).toHaveLength(before);

    await api().delete(`/api/shared/groups/${id}/settlements/${settlementId}`).set("Authorization", owner.auth).expect(200);
    group = await groupOf(owner, id);
    expect(balanceOf(group, b)).toBe(-2000);
  });

  it("checks who paid whom", async () => {
    const { owner, id, a } = await setUp("setchk");
    const send = (body: Record<string, unknown>) => api().post(`/api/shared/groups/${id}/settlements`).set("Authorization", owner.auth).send(body);
    await send({ fromMemberId: a, toMemberId: a, amount: 10 }).expect(400);
    await send({ fromMemberId: a, toMemberId: "nobody", amount: 10 }).expect(400);
    await send({ fromMemberId: a, toMemberId: "nobody", amount: 0 }).expect(400);
  });
});

describe("members with history", () => {
  it("can't leave owing or owed, and name-only people in expenses can't be removed", async () => {
    const { owner, friend, id, a, b, ravi } = await setUp("hist");
    await addExpense(owner, id, { description: "Tickets", amount: 900, paidById: a, split: { type: "equal", memberIds: [a, b, ravi] } }).expect(201);

    const res = await api().post(`/api/shared/groups/${id}/leave`).set("Authorization", friend.auth).expect(400);
    expect(res.body.error).toBe("Settle up first: you owe ₹300 in this group");
    await api().delete(`/api/shared/groups/${id}/members/${ravi}`).set("Authorization", owner.auth).expect(400);

    await api().post(`/api/shared/groups/${id}/settlements`).set("Authorization", owner.auth).send({ fromMemberId: b, toMemberId: a, amount: 300 }).expect(201);
    await api().post(`/api/shared/groups/${id}/leave`).set("Authorization", friend.auth).expect(200);
    // They still show by name where they appear
    const group = await groupOf(owner, id);
    expect(group.members.find((m: Member) => m.id === b)).toMatchObject({ status: "left", balance: 0 });
  });

  it("gives someone taking over a name-only spot that spot's shares in their Tracker", async () => {
    const { owner, id, a, ravi } = await setUp("claim");
    const raviUser = await createUser("claim_ravi");
    await addExpense(owner, id, { description: "Boat", amount: 800, paidById: a, split: { type: "equal", memberIds: [a, ravi] } }).expect(201);

    const token = (await api().post(`/api/shared/groups/${id}/members/${ravi}/link`).set("Authorization", owner.auth)).body.token;
    await api().post(`/api/shared/join/${token}`).set("Authorization", raviUser.auth).expect(200);
    const [entry] = await trackerOf(raviUser);
    expect(entry).toMatchObject({ amount: 400, note: "Boat (Goa)" });
    expect((await groupOf(owner, id)).activity[0].message).toBe(`${raviUser.username} joined the group as Ravi`);
  });

  it("sends budget alerts to the members whose share crosses their budget", async () => {
    const { owner, friend, id, a, b } = await setUp("bud");
    await api().put("/api/budgets").set("Authorization", friend.auth).send({ category: "Food", amount: 1000 }).expect(200);
    const res = await addExpense(owner, id, { description: "Feast", amount: 2400, paidById: a, split: { type: "equal", memberIds: [a, b] }, tzOffset: 0 }).expect(201);
    // The owner has no budget, so nothing comes back for their toast
    expect(res.body.budgetAlert).toBeNull();
    expect((await inboxOf(friend)).some((n: { kind: string }) => n.kind === "budget_over")).toBe(true);
  });

  it("deletes a group with all its expenses when its last user deletes their account", async () => {
    const owner = await createUser("solo");
    const id = (await api().post("/api/shared/groups").set("Authorization", owner.auth).send({ name: "Solo" }).expect(201)).body.group.id;
    await api().post(`/api/shared/groups/${id}/members`).set("Authorization", owner.auth).send({ name: "Ravi" }).expect(201);
    const [a, ravi] = (await groupOf(owner, id)).members.map((m: Member) => m.id);
    await addExpense(owner, id, { description: "Lunch", amount: 500, paidById: a, split: { type: "equal", memberIds: [a, ravi] } }).expect(201);
    await api().post(`/api/shared/groups/${id}/settlements`).set("Authorization", owner.auth).send({ fromMemberId: ravi, toMemberId: a, amount: 100 }).expect(201);

    await api().delete("/api/account").set("Authorization", owner.auth).send({ password: owner.password }).expect(200);
    expect(await prisma.sharedGroup.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.sharedExpense.count({ where: { groupId: id } })).toBe(0);
  });
});

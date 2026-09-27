import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";
import { occurrenceIn, toLocalDate } from "../src/modules/recurring/recurrence";

const IST = -330;
beforeAll(resetDatabase);

async function addTransaction(auth: string, body: Record<string, unknown>) {
  return (await api().post("/api/transactions").set("Authorization", auth).send(body).expect(201)).body.transaction;
}
const run = (auth: string) => api().post("/api/recurring/run").set("Authorization", auth).expect(200);
const entries = (userId: string, recurringId: string) =>
  prisma.transaction.findMany({ where: { userId, recurringId }, orderBy: { date: "asc" } });

// Makes a rule overdue by moving its next entry into the past, as if the user had been away
async function makeOverdue(ruleId: string, monthsAgo: number) {
  const now = toLocalDate(new Date(), IST);
  const rule = await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: ruleId } });
  await prisma.recurringTransaction.update({
    where: { id: ruleId },
    data: { nextDue: occurrenceIn(now.year, now.month - monthsAgo, rule.dayOfMonth, IST) },
  });
}

async function setup(prefix: string) {
  const user = await createUser(prefix);
  const userId = (await prisma.user.findFirstOrThrow({ where: { email: user.email } })).id;
  const first = await addTransaction(user.auth, { amount: 18000, type: "expense", category: "Rent", date: new Date().toISOString() });
  const res = await api()
    .post("/api/recurring")
    .set("Authorization", user.auth)
    .send({ amount: 18000, type: "expense", category: "Rent", dayOfMonth: 1, tzOffset: IST, firstEntryId: first.id })
    .expect(201);
  return { user, userId, rule: res.body.recurring, first };
}

describe("recurring transactions", () => {
  it("links the first entry and schedules the next one for next month", async () => {
    const { userId, rule, first } = await setup("link");
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: first.id } })).recurringId).toBe(rule.id);
    const next = toLocalDate(new Date(rule.nextDue), IST);
    const today = toLocalDate(new Date(), IST);
    expect(next.day).toBe(1);
    expect((next.year * 12 + next.month) - (today.year * 12 + today.month)).toBe(1);
    expect(await entries(userId, rule.id)).toHaveLength(1);
  });

  it("adds each missed month exactly once, even when two catch-ups run at the same time", async () => {
    const { user, userId, rule } = await setup("catchup");
    await makeOverdue(rule.id, 2);
    const [a, b] = await Promise.all([run(user.auth), run(user.auth)]);
    const reported = [...a.body.added, ...b.body.added].reduce((sum: number, x: { count: number }) => sum + x.count, 0);
    expect(reported).toBe(3); // two months ago, last month and this month
    expect(await entries(userId, rule.id)).toHaveLength(4); // plus the first entry
    await run(user.auth);
    expect(await entries(userId, rule.id)).toHaveLength(4);
  });

  it("never brings back an entry the user deleted", async () => {
    const { user, userId, rule } = await setup("deleted");
    await makeOverdue(rule.id, 0);
    await run(user.auth);
    const all = await entries(userId, rule.id);
    await api().delete(`/api/transactions/${all[all.length - 1].id}`).set("Authorization", user.auth).expect(200);
    await run(user.auth);
    expect(await entries(userId, rule.id)).toHaveLength(all.length - 1);
  });

  it("adds nothing while paused and does not fill in paused months after resuming", async () => {
    const { user, userId, rule } = await setup("pause");
    await api().post(`/api/recurring/${rule.id}/pause`).set("Authorization", user.auth).expect(200);
    await makeOverdue(rule.id, 3);
    await run(user.auth);
    expect(await entries(userId, rule.id)).toHaveLength(1);

    const resumed = (await api().post(`/api/recurring/${rule.id}/resume`).set("Authorization", user.auth).expect(200)).body.recurring;
    expect(new Date(resumed.nextDue).getTime()).toBeGreaterThan(Date.now() - 24 * 60 * 60 * 1000);
    await run(user.auth);
    expect((await entries(userId, rule.id)).length).toBeLessThanOrEqual(2);
  });

  it("stops without deleting the entries already added", async () => {
    const { user, userId, rule, first } = await setup("stop");
    await api().delete(`/api/recurring/${rule.id}`).set("Authorization", user.auth).expect(200);
    const kept = await prisma.transaction.findUniqueOrThrow({ where: { id: first.id } });
    expect(kept.recurringId).toBeNull();
    expect(await prisma.transaction.count({ where: { userId } })).toBe(1);
  });

  it("keeps rules private and validates input", async () => {
    const { rule } = await setup("owner");
    const other = await createUser("other");
    await api().post(`/api/recurring/${rule.id}/pause`).set("Authorization", other.auth).expect(404);
    await api().delete(`/api/recurring/${rule.id}`).set("Authorization", other.auth).expect(404);
    expect((await api().get("/api/recurring").set("Authorization", other.auth)).body.recurring).toHaveLength(0);
    await api()
      .post("/api/recurring")
      .set("Authorization", other.auth)
      .send({ amount: 100, type: "expense", category: "Gym", dayOfMonth: 32, tzOffset: IST })
      .expect(400);
  });

  it("is included in the data export and removed with the account", async () => {
    const { user, userId } = await setup("export");
    const exported = (await api().get("/api/account/export").set("Authorization", user.auth)).body.data;
    expect(exported.recurring).toHaveLength(1);
    await api().delete("/api/account").set("Authorization", user.auth).send({ password: user.password }).expect(200);
    expect(await prisma.recurringTransaction.count({ where: { userId } })).toBe(0);
  });
});

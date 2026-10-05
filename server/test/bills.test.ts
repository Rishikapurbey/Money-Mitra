import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";
import { daysUntil, firstDue, nextOccurrence, occurrenceIn, toLocalDate } from "../src/modules/recurring/recurrence";
import { billsInMonth, remindBills } from "../src/modules/recurring/recurring.service";
import { monthBounds } from "../src/modules/recaps/recap.service";

const IST = -330;
beforeAll(resetDatabase);

const day = (iso: string) => new Date(`${iso}T06:30:00Z`); // midday in India

describe("yearly dates", () => {
  it("finds the next yearly date, and steps a year at a time", () => {
    const due = firstDue(day("2026-10-05"), 20, IST, "yearly", 2); // 20 March
    expect(toLocalDate(due, IST)).toEqual({ year: 2027, month: 2, day: 20 });
    expect(toLocalDate(firstDue(day("2026-10-05"), 20, IST, "yearly", 9), IST)).toEqual({ year: 2026, month: 9, day: 20 });
    expect(toLocalDate(nextOccurrence(due, 20, IST, "yearly"), IST)).toEqual({ year: 2028, month: 2, day: 20 });
  });

  it("counts whole days in the user's timezone", () => {
    const due = occurrenceIn(2026, 9, 7, IST);
    expect(daysUntil(due, day("2026-10-05"), IST)).toBe(2);
    expect(daysUntil(due, new Date("2026-10-06T19:00:00Z"), IST)).toBe(0); // already the 7th in India
    expect(daysUntil(due, day("2026-10-09"), IST)).toBe(-2);
  });
});

describe("bills", () => {
  type User = Awaited<ReturnType<typeof createUser>>;

  async function setup(prefix: string, body: Record<string, unknown> = {}) {
    const user = await createUser(prefix);
    const userId = (await prisma.user.findFirstOrThrow({ where: { email: user.email } })).id;
    const res = await api()
      .post("/api/recurring")
      .set("Authorization", user.auth)
      .send({ type: "expense", category: "Bills", note: "Credit card", mode: "remind", amount: null, dayOfMonth: 7, tzOffset: IST, ...body })
      .expect(201);
    return { user, userId, bill: res.body.recurring as { id: string; nextDue: string } };
  }
  const setDue = (id: string, iso: string) => prisma.recurringTransaction.update({ where: { id }, data: { nextDue: day(iso) } });
  const pay = (user: User, id: string, body: Record<string, unknown>) =>
    api().post(`/api/recurring/${id}/pay`).set("Authorization", user.auth).send({ tzOffset: IST, ...body });

  it("never adds a bill by itself, and allows an empty amount only for bills", async () => {
    const { user, userId, bill } = await setup("bills");
    await setDue(bill.id, "2026-01-07");
    await api().post("/api/recurring/run").set("Authorization", user.auth).expect(200);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(0);

    await api()
      .post("/api/recurring")
      .set("Authorization", user.auth)
      .send({ type: "expense", category: "Rent", mode: "auto", amount: null, dayOfMonth: 1, tzOffset: IST })
      .expect(400);
  });

  it("reminds two days before and on the day, once each", async () => {
    const { user, userId, bill } = await setup("reminders", { amount: 12000 });
    await setDue(bill.id, "2026-10-07");

    expect(await remindBills(userId, day("2026-10-04"))).toBe(0);
    expect(await remindBills(userId, day("2026-10-05"))).toBe(1);
    expect(await remindBills(userId, day("2026-10-06"))).toBe(0);
    expect(await remindBills(userId, day("2026-10-07"))).toBe(1);
    expect(await remindBills(userId, day("2026-10-08"))).toBe(0);

    const bell = (await api().get("/api/notifications").set("Authorization", user.auth).expect(200)).body.notifications;
    expect(bell.map((n: { kind: string; message: string }) => [n.kind, n.message])).toEqual([
      ["bill_today", "Credit card (₹12,000) is due today"],
      ["bill_soon", "Credit card (₹12,000) is due in 2 days"],
    ]);
  });

  it("says when a bill was missed, and stays quiet for paused ones", async () => {
    const { userId, bill } = await setup("missed");
    await setDue(bill.id, "2026-10-01");
    expect(await remindBills(userId, day("2026-10-05"))).toBe(1);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId } });
    expect(n.title).toBe("Credit card was due on 1 Oct");

    await prisma.recurringTransaction.update({ where: { id: bill.id }, data: { paused: true, nextDue: day("2026-11-07") } });
    expect(await remindBills(userId, day("2026-11-07"))).toBe(0);
  });

  it("records a payment with the amount entered, moves to the next month, and can't be paid twice", async () => {
    const { user, userId, bill } = await setup("pay");
    await setDue(bill.id, "2026-10-07");
    await pay(user, bill.id, { amount: 0 }).expect(400);

    const res = await pay(user, bill.id, { amount: 8450, date: day("2026-10-04").toISOString() }).expect(200);
    expect(toLocalDate(new Date(res.body.recurring.nextDue), IST)).toEqual({ year: 2026, month: 10, day: 7 });
    const entry = await prisma.transaction.findFirstOrThrow({ where: { userId } });
    expect(entry).toMatchObject({ amount: 8450, category: "Bills", note: "Credit card", recurringId: bill.id });

    // Two presses at once (say, two open tabs) record the payment only once
    const results = await Promise.all([pay(user, bill.id, { amount: 9000 }), pay(user, bill.id, { amount: 9000 })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(2);
  });

  it("skips a due date without recording anything", async () => {
    const { user, userId, bill } = await setup("skip");
    await setDue(bill.id, "2026-10-07");
    const res = await api().post(`/api/recurring/${bill.id}/skip`).set("Authorization", user.auth).expect(200);
    expect(toLocalDate(new Date(res.body.recurring.nextDue), IST).month).toBe(10);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(0);
  });

  it("supports yearly bills", async () => {
    const { user, bill } = await setup("yearly", { note: "Car insurance", frequency: "yearly", monthOfYear: 2, dayOfMonth: 20, amount: 14000 });
    expect(toLocalDate(new Date(bill.nextDue), IST)).toMatchObject({ month: 2, day: 20 });
    const res = await pay(user, bill.id, { amount: 14000 }).expect(200);
    expect(toLocalDate(new Date(res.body.recurring.nextDue), IST).year).toBe(toLocalDate(new Date(bill.nextDue), IST).year + 1);
  });

  it("only lets the owner pay or skip, and only for bills", async () => {
    const { bill } = await setup("owner");
    const other = await createUser("intruder");
    await pay(other, bill.id, { amount: 10 }).expect(404);
    await api().post(`/api/recurring/${bill.id}/skip`).set("Authorization", other.auth).expect(404);

    const auto = await api()
      .post("/api/recurring")
      .set("Authorization", other.auth)
      .send({ type: "expense", category: "Rent", amount: 15000, dayOfMonth: 1, tzOffset: IST })
      .expect(201);
    await pay(other, auto.body.recurring.id, { amount: 10 }).expect(400);
  });

  it("counts bills paid on time for the monthly recap", async () => {
    const { user, userId, bill } = await setup("ontime");
    const second = (
      await api()
        .post("/api/recurring")
        .set("Authorization", user.auth)
        .send({ type: "expense", category: "Bills", note: "Electricity", mode: "remind", amount: 1800, dayOfMonth: 20, tzOffset: IST })
        .expect(201)
    ).body.recurring;
    const third = (
      await api()
        .post("/api/recurring")
        .set("Authorization", user.auth)
        .send({ type: "expense", category: "Bills", note: "Internet", mode: "remind", amount: 700, dayOfMonth: 25, tzOffset: IST })
        .expect(201)
    ).body.recurring;

    await setDue(bill.id, "2026-09-07");
    await pay(user, bill.id, { amount: 9000, date: day("2026-09-07").toISOString() }).expect(200); // on the day
    await setDue(second.id, "2026-09-20");
    await pay(user, second.id, { amount: 1800, date: day("2026-09-23").toISOString() }).expect(200); // late
    await setDue(third.id, "2026-09-25"); // never paid

    const sept = monthBounds("2026-09", IST);
    expect(await billsInMonth(userId, sept.from, sept.to, day("2026-10-04"))).toEqual({ onTime: 1, total: 3 });
    const aug = monthBounds("2026-08", IST);
    expect(await billsInMonth(userId, aug.from, aug.to, day("2026-10-04"))).toBeNull();
  });
});

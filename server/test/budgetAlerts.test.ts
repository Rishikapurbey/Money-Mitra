import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import { sendEmail } from "../src/lib/email";
import prisma from "../src/db/prisma";
import { localMonth } from "../src/modules/budgets/budgetAlert.service";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

beforeAll(resetDatabase);

const IST = -330;
const monthName = localMonth(new Date(), IST).name;

const spend = (auth: string, amount: number, category = "Food", date = new Date()) =>
  api()
    .post("/api/transactions")
    .set("Authorization", auth)
    .send({ amount, type: "expense", category, date: date.toISOString(), tzOffset: IST })
    .expect(201);

async function withBudget(prefix: string, amount = 10000, category = "Food") {
  const user = await createUser(prefix);
  await api().put("/api/budgets").set("Authorization", user.auth).send({ category, amount }).expect(200);
  return user;
}

const bell = async (auth: string) =>
  (await api().get("/api/notifications").set("Authorization", auth).expect(200)).body.notifications as {
    kind: string;
    message: string;
    title: string;
  }[];

describe("localMonth", () => {
  it("uses the user's month, not the server's", () => {
    // 31 Oct 20:00 UTC is already 1 Nov in India
    const month = localMonth(new Date("2026-10-31T20:00:00Z"), IST);
    expect(month.key).toBe("2026-11");
    expect(month.from.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(month.to.toISOString()).toBe("2026-11-30T18:30:00.000Z");
  });
});

describe("budget alerts", () => {
  it("alerts once at 80% and once at 100%, with a message for a toast", async () => {
    const user = await withBudget("alerts");
    expect((await spend(user.auth, 5000)).body.budgetAlert).toBeNull();

    const near = (await spend(user.auth, 3500)).body.budgetAlert;
    expect(near).toEqual({ level: 80, message: `You've used 85% of your Food budget for ${monthName}` });
    expect((await spend(user.auth, 500)).body.budgetAlert).toBeNull();

    const over = (await spend(user.auth, 1500)).body.budgetAlert;
    expect(over).toEqual({ level: 100, message: `You're over your Food budget for ${monthName}` });
    expect((await spend(user.auth, 2000)).body.budgetAlert).toBeNull();

    const items = await bell(user.auth);
    expect(items.map((n) => n.kind)).toEqual(["budget_over", "budget_near"]);
    expect(items[0]).toMatchObject({ message: over.message, title: "" });
  });

  it("goes straight to the over-budget alert when one expense jumps past the limit", async () => {
    const user = await withBudget("jump");
    await spend(user.auth, 6000);
    expect((await spend(user.auth, 6000)).body.budgetAlert.level).toBe(100);
    // Coming back under and crossing 80% again later this month stays quiet
    const expenses = (await api().get("/api/transactions").set("Authorization", user.auth)).body.transactions;
    await api().delete(`/api/transactions/${expenses[0].id}`).set("Authorization", user.auth).expect(200);
    expect((await spend(user.auth, 2500)).body.budgetAlert).toBeNull();
    expect((await bell(user.auth)).map((n) => n.kind)).toEqual(["budget_over"]);
  });

  it("checks edited expenses, ignores other months, income and categories without a budget", async () => {
    const user = await withBudget("edits");
    const lastMonth = new Date(localMonth(new Date(), IST).from.getTime() - 24 * 60 * 60 * 1000);
    expect((await spend(user.auth, 9000, "Food", lastMonth)).body.budgetAlert).toBeNull();
    expect((await spend(user.auth, 50000, "Travel")).body.budgetAlert).toBeNull();
    await api()
      .post("/api/transactions")
      .set("Authorization", user.auth)
      .send({ amount: 50000, type: "income", category: "Food", tzOffset: IST })
      .expect(201);

    const small = (await spend(user.auth, 1000)).body.transaction;
    const res = await api()
      .put(`/api/transactions/${small.id}`)
      .set("Authorization", user.auth)
      .send({ amount: 9000, type: "expense", category: "food", date: new Date().toISOString(), tzOffset: IST })
      .expect(200);
    expect(res.body.budgetAlert.level).toBe(80);
  });

  it("alerts when recurring entries push a budget over", async () => {
    const user = await withBudget("recurring", 15000, "Rent");
    const res = await api()
      .post("/api/recurring")
      .set("Authorization", user.auth)
      .send({ amount: 18000, type: "expense", category: "Rent", dayOfMonth: 1, tzOffset: IST })
      .expect(201);
    await prisma.recurringTransaction.update({ where: { id: res.body.recurring.id }, data: { nextDue: localMonth(new Date(), IST).from } });
    await api().post("/api/recurring/run").set("Authorization", user.auth).expect(200);
    expect((await bell(user.auth)).map((n) => n.kind)).toEqual(["budget_over"]);
  });

  it("respects the settings, and emails only when asked and confirmed", async () => {
    const quiet = await withBudget("quiet");
    await api().put("/api/account/email-preferences").set("Authorization", quiet.auth).send({ budgetAlerts: false }).expect(200);
    expect((await spend(quiet.auth, 9000)).body.budgetAlert).toBeNull();
    expect(await bell(quiet.auth)).toHaveLength(0);

    const inApp = await withBudget("inapp");
    vi.mocked(sendEmail).mockClear();
    await spend(inApp.auth, 9000);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();

    const emailed = await withBudget("emailed");
    const prefs = await api().put("/api/account/email-preferences").set("Authorization", emailed.auth).send({ emailBudgetAlerts: true }).expect(200);
    expect(prefs.body).toEqual({ emailReplies: true, budgetAlerts: true, emailBudgetAlerts: true });
    vi.mocked(sendEmail).mockClear();
    await spend(emailed.auth, 12000);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
    const email = vi.mocked(sendEmail).mock.calls[0][0];
    expect(email.to).toBe(emailed.email);
    expect(email.text).toContain("₹12,000 of ₹10,000");

    const unconfirmed = await withBudget("unconfirmed");
    await api().put("/api/account/email-preferences").set("Authorization", unconfirmed.auth).send({ emailBudgetAlerts: true }).expect(200);
    await prisma.user.update({ where: { email: unconfirmed.email }, data: { emailVerifiedAt: null } });
    vi.mocked(sendEmail).mockClear();
    await spend(unconfirmed.auth, 12000);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });

  it("rejects bad preference values", async () => {
    const user = await createUser("prefs");
    await api().put("/api/account/email-preferences").set("Authorization", user.auth).send({ budgetAlerts: "yes" }).expect(400);
    await api().put("/api/account/email-preferences").set("Authorization", user.auth).send({}).expect(400);
  });
});

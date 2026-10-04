import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";
import { getRecap } from "../src/modules/recaps/recap.service";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const createGoal = async (user: User, name = "Emergency fund", targetAmount = 100000) =>
  (await api().post("/api/goals").set("Authorization", user.auth).send({ name, targetAmount }).expect(201)).body.goal;
const contribute = async (user: User, id: string, amount: number) =>
  (await api().post(`/api/goals/${id}/contributions`).set("Authorization", user.auth).send({ amount }).expect(200)).body.goal;
const history = async (user: User, id: string) =>
  (await api().get(`/api/goals/${id}/contributions`).set("Authorization", user.auth).expect(200)).body as {
    entries: { amount: number }[];
    more: boolean;
    beforeHistory: number;
  };

describe("goal history", () => {
  it("records each change as actually applied, newest first", async () => {
    const user = await createUser("goals");
    const goal = await createGoal(user);
    await contribute(user, goal.id, 5000);
    await contribute(user, goal.id, 2000);
    // Only 7,000 is there, so withdrawing 10,000 takes out 7,000
    const emptied = await contribute(user, goal.id, -10000);
    expect(emptied.savedAmount).toBe(0);
    // Nothing left to withdraw, so nothing is recorded
    await contribute(user, goal.id, -500);

    const h = await history(user, goal.id);
    expect(h.entries.map((e) => e.amount)).toEqual([-7000, 2000, 5000]);
    expect(h).toMatchObject({ more: false, beforeHistory: 0 });
  });

  it("shows money saved before history started without inventing dates for it", async () => {
    const user = await createUser("legacy");
    const goal = await createGoal(user, "Trip");
    await prisma.goal.update({ where: { id: goal.id }, data: { savedAmount: 12000 } });
    await contribute(user, goal.id, 3000);
    const h = await history(user, goal.id);
    expect(h.entries.map((e) => e.amount)).toEqual([3000]);
    expect(h.beforeHistory).toBe(12000);
  });

  it("keeps history private and removes it with the goal", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const goal = await createGoal(owner);
    await contribute(owner, goal.id, 1000);
    await api().get(`/api/goals/${goal.id}/contributions`).set("Authorization", other.auth).expect(404);

    await api().delete(`/api/goals/${goal.id}`).set("Authorization", owner.auth).expect(200);
    expect(await prisma.goalContribution.count({ where: { goalId: goal.id } })).toBe(0);
  });

  it("feeds the monthly recap with what went into each goal that month", async () => {
    const user = await createUser("recapgoals");
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email: user.email } })).id;
    const fund = await createGoal(user, "Emergency fund");
    const trip = await createGoal(user, "Trip");
    await contribute(user, fund.id, 4000);
    await contribute(user, trip.id, 1500);
    await contribute(user, trip.id, -500);
    // Move this history into September so the recap for September can see it
    await prisma.goalContribution.updateMany({ where: { userId }, data: { createdAt: new Date("2026-09-15T06:30:00Z") } });
    for (const [amount, type, category] of [[50000, "income", "Salary"], [5000, "expense", "Food"], [9000, "expense", "Rent"]] as const) {
      await api().post("/api/transactions").set("Authorization", user.auth).send({ amount, type, category, date: "2026-09-10T06:30:00Z" }).expect(201);
    }

    const recap = await getRecap(userId, "2026-09", -330, new Date("2026-10-04T06:30:00Z"));
    expect(recap.goals.map((g) => [g.name, g.added])).toEqual([
      ["Emergency fund", 4000],
      ["Trip", 1000],
    ]);
    expect(recap.goalsAdded).toBe(5000);

    const august = await getRecap(userId, "2026-08", -330, new Date("2026-10-04T06:30:00Z"));
    expect(august.goalsAdded).toBe(0);
  });
});

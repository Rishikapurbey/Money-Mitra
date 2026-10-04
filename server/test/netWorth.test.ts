import { beforeAll, describe, expect, it } from "vitest";
import { netWorthAt, netWorthChange } from "../src/modules/networth/networth";
import { getNetWorth, netWorthSummary } from "../src/modules/networth/networth.service";
import { getRecap } from "../src/modules/recaps/recap.service";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const IST = -330;
const v = (itemId: string, kind: string, value: number, iso: string) => ({ itemId, kind, value, recordedAt: new Date(iso) });

describe("netWorthAt", () => {
  const values = [
    v("bank", "asset", 50000, "2026-01-10T00:00:00Z"),
    v("loan", "liability", 200000, "2026-01-15T00:00:00Z"),
    v("bank", "asset", 80000, "2026-03-01T00:00:00Z"),
    v("mf", "asset", 120000, "2026-03-05T00:00:00Z"),
    v("loan", "liability", 180000, "2026-04-01T00:00:00Z"),
  ];

  it("uses each item's latest value on or before the date", () => {
    expect(netWorthAt(values, new Date("2026-01-01T00:00:00Z"))).toBeNull();
    expect(netWorthAt(values, new Date("2026-02-01T00:00:00Z"))).toEqual({ assets: 50000, liabilities: 200000, netWorth: -150000 });
    expect(netWorthAt(values, new Date("2026-04-02T00:00:00Z"))).toEqual({ assets: 200000, liabilities: 180000, netWorth: 20000 });
  });

  it("works out the change over a period only when the start is known", () => {
    expect(netWorthChange(values, new Date("2026-02-01T00:00:00Z"), new Date("2026-04-02T00:00:00Z"))).toEqual({
      start: -150000,
      end: 20000,
      change: 170000,
    });
    expect(netWorthChange(values, new Date("2025-12-01T00:00:00Z"), new Date("2026-04-02T00:00:00Z"))).toBeNull();
  });
});

describe("net worth items", () => {
  const add = async (user: User, body: Record<string, unknown>) =>
    (await api().post("/api/networth/items").set("Authorization", user.auth).send(body).expect(201)).body.item;
  const overview = async (user: User) =>
    (await api().get("/api/networth").set("Authorization", user.auth).query({ tzOffset: IST }).expect(200)).body;

  it("adds things you own and owe, updates values and keeps their history", async () => {
    const user = await createUser("networth");
    const bank = await add(user, { name: "HDFC savings", kind: "asset", type: "bank", value: 85000 });
    await add(user, { name: "Car loan", kind: "liability", type: "vehicle_loan", value: 300000 });
    await api().post(`/api/networth/items/${bank.id}/values`).set("Authorization", user.auth).send({ value: 95000 }).expect(200);

    const data = await overview(user);
    expect(data.totals).toEqual({ assets: 95000, liabilities: 300000, netWorth: -205000 });
    expect(data.items.map((i: { name: string; value: number }) => [i.name, i.value])).toEqual([
      ["HDFC savings", 95000],
      ["Car loan", 300000],
    ]);
    expect(data.history).toHaveLength(1);

    const history = (await api().get(`/api/networth/items/${bank.id}/values`).set("Authorization", user.auth).expect(200)).body.values;
    expect(history.map((h: { value: number }) => h.value)).toEqual([95000, 85000]);
  });

  it("checks what's entered", async () => {
    const user = await createUser("nwcheck");
    const post = (body: Record<string, unknown>) => api().post("/api/networth/items").set("Authorization", user.auth).send(body);
    await post({ name: "", kind: "asset", type: "bank", value: 1 }).expect(400);
    await post({ name: "Gold", kind: "asset", type: "home_loan", value: 1 }).expect(400);
    await post({ name: "Gold", kind: "thing", type: "gold", value: 1 }).expect(400);
    await post({ name: "Gold", kind: "asset", type: "gold", value: -5 }).expect(400);
    await post({ name: "Gold", kind: "asset", type: "gold", value: "" }).expect(400);
  });

  it("removing an item counts it as zero from now on without changing the past", async () => {
    const user = await createUser("nwremove");
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email: user.email } })).id;
    const fd = await add(user, { name: "SBI FD", kind: "asset", type: "fd", value: 100000 });
    await prisma.netWorthValue.updateMany({ where: { itemId: fd.id }, data: { recordedAt: new Date("2026-08-01T06:30:00Z") } });

    await api().delete(`/api/networth/items/${fd.id}`).set("Authorization", user.auth).expect(200);
    const data = await overview(user);
    expect(data.items).toHaveLength(0);
    expect(data.totals.netWorth).toBe(0);

    const august = await getNetWorth(userId, IST, new Date("2026-08-20T06:30:00Z"));
    expect(august.totals.netWorth).toBe(100000);
    await api().post(`/api/networth/items/${fd.id}/values`).set("Authorization", user.auth).send({ value: 5 }).expect(404);
  });

  it("keeps items private to their owner", async () => {
    const owner = await createUser("nwowner");
    const other = await createUser("nwother");
    const item = await add(owner, { name: "Gold", kind: "asset", type: "gold", value: 50000 });
    await api().post(`/api/networth/items/${item.id}/values`).set("Authorization", other.auth).send({ value: 1 }).expect(404);
    await api().get(`/api/networth/items/${item.id}/values`).set("Authorization", other.auth).expect(404);
    await api().delete(`/api/networth/items/${item.id}`).set("Authorization", other.auth).expect(404);
    expect((await overview(other)).items).toHaveLength(0);
  });

  it("reminds once a month when values are out of date, unless turned off", async () => {
    const user = await createUser("nwremind");
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email: user.email } })).id;
    expect((await netWorthSummary(userId, IST)).summary).toBeNull();

    await add(user, { name: "Savings", kind: "asset", type: "bank", value: 10000 });
    const fresh = await netWorthSummary(userId, IST);
    expect(fresh).toMatchObject({ summary: { netWorth: 10000, stale: false }, notified: false });

    const later = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    expect((await netWorthSummary(userId, IST, later)).notified).toBe(true);
    expect((await netWorthSummary(userId, IST, later)).notified).toBe(false);
    const bell = (await api().get("/api/notifications").set("Authorization", user.auth).expect(200)).body.notifications;
    expect(bell[0]).toMatchObject({ kind: "networth_reminder", message: "Time to update your net worth" });

    const quiet = await createUser("nwquiet");
    const quietId = (await prisma.user.findUniqueOrThrow({ where: { email: quiet.email } })).id;
    await api().put("/api/account/email-preferences").set("Authorization", quiet.auth).send({ netWorthReminder: false }).expect(200);
    await add(quiet, { name: "Cash", kind: "asset", type: "cash", value: 500 });
    expect((await netWorthSummary(quietId, IST, later)).notified).toBe(false);
  });

  it("shows the change in the monthly recap", async () => {
    const user = await createUser("nwrecap");
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email: user.email } })).id;
    const bank = await add(user, { name: "Savings", kind: "asset", type: "bank", value: 40000 });
    await prisma.netWorthValue.updateMany({ where: { itemId: bank.id }, data: { recordedAt: new Date("2026-08-25T06:30:00Z") } });
    await api().post(`/api/networth/items/${bank.id}/values`).set("Authorization", user.auth).send({ value: 55000 }).expect(200);
    await prisma.netWorthValue.updateMany({ where: { itemId: bank.id, value: 55000 }, data: { recordedAt: new Date("2026-09-28T06:30:00Z") } });

    const recap = await getRecap(userId, "2026-09", IST, new Date("2026-10-04T06:30:00Z"));
    expect(recap.netWorth).toEqual({ start: 40000, end: 55000, change: 15000 });
    const august = await getRecap(userId, "2026-08", IST, new Date("2026-10-04T06:30:00Z"));
    expect(august.netWorth).toBeNull();
  });
});

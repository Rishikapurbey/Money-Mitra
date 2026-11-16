import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";
import { signupsByWeek } from "../src/modules/admin/admin.service";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

type Admin = Awaited<ReturnType<typeof createUser>>;
let admin: Admin;

beforeAll(async () => {
  await resetDatabase();
  admin = await createUser("boss");
  process.env.ADMIN_EMAIL = admin.email.toUpperCase(); // matching ignores case
});

const overview = (auth: string) => api().get("/api/admin").set("Authorization", auth);

describe("who can open the admin page", () => {
  it("answers Not found to everyone but the admin", async () => {
    const someone = await createUser("someone");
    await api().get("/api/admin").expect(401);
    expect((await overview(someone.auth).expect(404)).body).toEqual({ error: "Not found" });
    await overview(admin.auth).expect(200);
  });

  it("needs the admin email to be confirmed", async () => {
    await prisma.user.update({ where: { email: admin.email }, data: { emailVerifiedAt: null } });
    await overview(admin.auth).expect(404);
    await prisma.user.update({ where: { email: admin.email }, data: { emailVerifiedAt: new Date() } });
  });

  it("is closed when ADMIN_EMAIL isn't set", async () => {
    const saved = process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_EMAIL;
    await overview(admin.auth).expect(404);
    process.env.ADMIN_EMAIL = saved;
  });
});

describe("what it shows", () => {
  it("counts people and feature use without any money or emails", async () => {
    const saver = await createUser("saver");
    await api().post("/api/transactions").set("Authorization", saver.auth).send({ type: "expense", category: "Food", amount: 98765 }).expect(201);
    await api().post("/api/networth/items").set("Authorization", saver.auth).send({ kind: "asset", type: "bank", name: "HDFC", value: 4321987 }).expect(201);

    const res = await overview(admin.auth).expect(200);
    const body = res.body;
    const users = await prisma.user.count();
    expect(body.users.total).toBe(users);
    expect(body.users.verified).toBe(users);
    expect(body.users.newThisWeek).toBe(users);
    expect(body.signupsByWeek).toHaveLength(12);
    expect(body.signupsByWeek.at(-1).signups).toBe(users);

    const feature = (key: string) => body.features.find((f: { key: string }) => f.key === key).users;
    expect(feature("tracker")).toBe(1);
    expect(feature("netWorth")).toBe(1);
    expect(feature("goals")).toBe(0);

    // Nothing from anyone's Tracker or net worth, and no email addresses
    const text = JSON.stringify(body);
    expect(text).not.toContain("98765");
    expect(text).not.toContain("4321987");
    expect(text).not.toContain("HDFC");
    expect(text).not.toContain("@example.com");
    expect(text).not.toMatch(/"(amount|value|balance|email)"/);

    const row = body.people.shown.find((p: { username: string }) => p.username === saver.username);
    expect(row).toMatchObject({ verified: true, displayName: null, avatarUrl: null });
    expect(row.joinedAt).toBeTruthy();
  });

  it("records when people last used the app, at most once an hour", async () => {
    const user = await createUser("visitor");
    await api().get("/api/auth/me").set("Authorization", user.auth).expect(200);
    const first = (await prisma.user.findUniqueOrThrow({ where: { email: user.email } })).lastActiveAt;
    expect(first).toBeInstanceOf(Date);

    await api().get("/api/auth/me").set("Authorization", user.auth).expect(200);
    const second = (await prisma.user.findUniqueOrThrow({ where: { email: user.email } })).lastActiveAt;
    expect(second).toEqual(first);

    // Someone last seen 40 days ago isn't counted as active this month
    await prisma.user.update({ where: { email: user.email }, data: { lastActiveAt: new Date(Date.now() - 40 * 86400000) } });
    const before = (await overview(admin.auth)).body.active.month;
    await api().get("/api/auth/me").set("Authorization", user.auth).expect(200);
    expect((await overview(admin.auth)).body.active.month).toBe(before + 1);
  });

  it("groups reports per question or reply, with reasons and whether it's hidden", async () => {
    const author = await createUser("author");
    const post = (await api().post("/api/posts").set("Authorization", author.auth).send({ title: "Spammy question here", body: "Buy my course", topic: "Investing" }).expect(201)).body.post;
    const reply = (await api().post(`/api/posts/${post.id}/replies`).set("Authorization", author.auth).send({ body: "Rude reply" }).expect(201)).body.reply;

    const reporters = await Promise.all(["r1", "r2", "r3"].map((p) => createUser(p)));
    for (const [i, r] of reporters.entries()) {
      await api().post(`/api/posts/${post.id}/report`).set("Authorization", r.auth).send({ reason: i === 0 ? "misleading" : "spam" }).expect(201);
    }
    await api().post(`/api/posts/${post.id}/replies/${reply.id}/report`).set("Authorization", reporters[0].auth).send({ reason: "abusive" }).expect(201);

    const { reports } = (await overview(admin.auth).expect(200)).body;
    const question = reports.find((r: { kind: string }) => r.kind === "question");
    expect(question).toMatchObject({
      id: post.id,
      postId: post.id,
      title: "Spammy question here",
      excerpt: "Buy my course",
      reports: 3,
      hidden: true,
      reasons: [
        { reason: "Spam", count: 2 },
        { reason: "Misleading money advice", count: 1 },
      ],
    });
    const replyItem = reports.find((r: { kind: string }) => r.kind === "reply");
    expect(replyItem).toMatchObject({ id: reply.id, postId: post.id, title: "Spammy question here", excerpt: "Rude reply", reports: 1, hidden: false });
  });
});

describe("signups by week", () => {
  it("uses Monday-to-Sunday weeks in India time", () => {
    const now = new Date("2026-11-18T12:00:00+05:30"); // a Wednesday
    const weeks = signupsByWeek(
      [
        new Date("2026-11-16T00:30:00+05:30"), // Monday just after midnight: this week
        new Date("2026-11-15T23:30:00+05:30"), // Sunday night: last week
        new Date("2026-11-09T09:00:00+05:30"), // last week's Monday
        new Date("2026-06-01T09:00:00+05:30"), // too long ago to show
      ],
      now,
      3
    );
    expect(weeks).toEqual([
      { week: "2026-11-02", signups: 0 },
      { week: "2026-11-09", signups: 2 },
      { week: "2026-11-16", signups: 1 },
    ]);
  });
});

import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import { sendEmail } from "../src/lib/email";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

type User = Awaited<ReturnType<typeof createUser>>;
let admin: User;

beforeAll(async () => {
  await resetDatabase();
  admin = await createUser("bl_admin");
  process.env.ADMIN_EMAIL = admin.email;
});

const blockUser = (from: User, to: User) => api().post(`/api/blocks/${to.username}`).set("Authorization", from.auth);
const unblockUser = (from: User, to: User) => api().delete(`/api/blocks/${to.username}`).set("Authorization", from.auth);
const follow = (from: User, to: User) => api().post(`/api/follows/${to.username}`).set("Authorization", from.auth);
const start = (from: User, to: User) => api().post("/api/chats").set("Authorization", from.auth).send({ username: to.username });
const send = (from: User, id: string, body: string) => api().post(`/api/chats/${id}/messages`).set("Authorization", from.auth).send({ body });
const find = async (user: User, q: string) =>
  ((await api().get("/api/search/people").query({ q }).set("Authorization", user.auth).expect(200)).body.people as { username: string }[]).map((p) => p.username);

describe("blocking", () => {
  it("cuts all contact both ways, silently, until unblocked", async () => {
    const me = await createUser("blk_me");
    const pest = await createUser("blk_pest");
    await follow(me, pest).expect(200);
    await follow(pest, me).expect(200);
    const chat = (await start(pest, me).expect(200)).body.id;
    await send(pest, chat, "Hey").expect(201);

    await blockUser(me, pest).expect(200);
    await blockUser(me, me).expect(400);

    // Follows both ways are gone, and neither can follow again
    await follow(pest, me).expect(404);
    expect((await follow(me, pest).expect(400)).body.error).toBe("Unblock them to follow");

    // My profile looks like it doesn't exist to them; theirs shows only who they are to me, with Unblock
    await api().get(`/api/users/${me.username}`).set("Authorization", pest.auth).expect(404);
    await api().get(`/api/users/${me.username}/followers`).set("Authorization", pest.auth).expect(404);
    const theirs = (await api().get(`/api/users/${pest.username}`).set("Authorization", me.auth).expect(200)).body;
    const profile = theirs.profile;
    expect(profile).toMatchObject({ blockedByMe: true, activity: null });

    // Hidden from each other in search
    expect(await find(pest, "blk_me")).not.toContain(me.username);
    expect(await find(me, "blk_pest")).not.toContain(pest.username);

    // The chat stays, but nobody can send; they're only told they can't message the account
    expect((await send(pest, chat, "Why?").expect(403)).body.error).toBe("You can't message this account");
    const myView = (await api().get(`/api/chats/${chat}`).set("Authorization", me.auth).expect(200)).body.conversation;
    expect(myView).toMatchObject({ canSend: false, blockedByMe: true });
    expect((await start(pest, me).expect(404)).body.error).toBe("You can't message this account");

    // Group invites are refused too
    const group = (await api().post("/api/shared/groups").set("Authorization", pest.auth).send({ name: "Trip" }).expect(201)).body.group.id;
    await api().post(`/api/shared/groups/${group}/members`).set("Authorization", pest.auth).send({ username: me.username }).expect(404);

    // Listed in Settings, and unblocking restores things (but not the old follows)
    const list = (await api().get("/api/blocks").set("Authorization", me.auth).expect(200)).body.blocked;
    expect(list.map((p: { username: string }) => p.username)).toEqual([pest.username]);
    await unblockUser(me, pest).expect(200);
    await send(pest, chat, "Sorry").expect(201);
    expect(await find(pest, "blk_me")).toContain(me.username);
    const after = (await api().get(`/api/users/${pest.username}`).set("Authorization", me.auth).expect(200)).body;
    expect(after.profile.followStatus).toBe("none");
  });
});

describe("reporting a message", () => {
  it("sends only that message to the admin, keeps its text even if unsent, and can block too", async () => {
    const me = await createUser("rep_me");
    const spammer = await createUser("rep_spam");
    const chat = (await start(spammer, me).expect(200)).body.id;
    const hi = (await send(spammer, chat, "Earn 50% a month, DM me").expect(201)).body.message;
    const mine = (await send(me, chat, "No thanks").expect(201)).body.message;

    const report = (body: object, id = hi.id) => api().post(`/api/chats/${chat}/messages/${id}/report`).set("Authorization", me.auth).send(body);
    await report({ reason: "boring" }).expect(400);
    await report({ reason: "spam" }, mine.id).expect(400);
    expect((await report({ reason: "scam", block: true }).expect(200)).body).toEqual({ reported: true, blocked: true });
    // Reporting twice doesn't count twice
    await report({ reason: "spam" }).expect(200);

    const reportEmails = vi.mocked(sendEmail).mock.calls.map((c) => c[0]).filter((e) => e.subject.startsWith("Message report"));
    expect(reportEmails).toHaveLength(1);
    expect(reportEmails[0]).toMatchObject({ to: admin.email, subject: "Message report: Scam or fraud" });
    expect((await send(spammer, chat, "Hello?").expect(403)).body.error).toBe("You can't message this account");

    // The sender unsends it afterwards: the admin still sees what was reported, and nothing else
    await api().delete(`/api/chats/${chat}/messages/${hi.id}`).set("Authorization", spammer.auth).expect(200);
    const overview = (await api().get("/api/admin").set("Authorization", admin.auth).expect(200)).body;
    expect(overview.messageReports).toEqual([
      {
        id: hi.id,
        text: "Earn 50% a month, DM me",
        sender: { username: spammer.username, displayName: null, avatarUrl: null },
        reports: 1,
        reasons: [{ reason: "Scam or fraud", count: 1 }],
        unsent: true,
        lastReportedAt: expect.any(String),
      },
    ]);
    expect(JSON.stringify(overview)).not.toContain("No thanks");
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const start = async (from: User, to: User) =>
  (await api().post("/api/chats").set("Authorization", from.auth).send({ username: to.username }).expect(200)).body.id as string;
const send = (from: User, id: string, body: string) => api().post(`/api/chats/${id}/messages`).set("Authorization", from.auth).send({ body });
const open = async (user: User, id: string) => (await api().get(`/api/chats/${id}`).set("Authorization", user.auth).expect(200)).body;
const inbox = async (user: User, tab = "chats") =>
  (await api().get("/api/chats").query({ tab }).set("Authorization", user.auth).expect(200)).body.conversations;
const unread = async (user: User) => (await api().get("/api/chats/unread").set("Authorization", user.auth).expect(200)).body;
const follow = (from: User, to: User) => api().post(`/api/follows/${to.username}`).set("Authorization", from.auth).expect(200);

describe("starting a chat", () => {
  it("opens one chat per pair, from either side, and never with yourself", async () => {
    const a = await createUser("ch_a");
    const b = await createUser("ch_b");
    const id = await start(a, b);
    expect(await start(b, a)).toBe(id);
    await api().post("/api/chats").set("Authorization", a.auth).send({ username: a.username }).expect(400);
    await api().post("/api/chats").set("Authorization", a.auth).send({ username: "nobody_here_123" }).expect(404);
    // An empty chat isn't in anyone's inbox
    expect(await inbox(a)).toEqual([]);
  });

  it("keeps chats private to the two people in them", async () => {
    const a = await createUser("ch_p1");
    const b = await createUser("ch_p2");
    const nosy = await createUser("ch_nosy");
    const id = await start(a, b);
    await send(a, id, "Hi").expect(201);
    await api().get(`/api/chats/${id}`).set("Authorization", nosy.auth).expect(404);
    await send(nosy, id, "Me too").expect(404);
    await api().get(`/api/chats/${id}`).expect(401);
  });

  it("checks the message text", async () => {
    const a = await createUser("ch_t1");
    const b = await createUser("ch_t2");
    const id = await start(a, b);
    await send(a, id, "   ").expect(400);
    await send(a, id, "x".repeat(2001)).expect(400);
    expect((await send(a, id, "  Hello  ").expect(201)).body.message).toMatchObject({ body: "Hello", mine: true, deleted: false });
  });
});

describe("message requests", () => {
  it("sends a stranger's first message as a request, allows only one until accepted, and tells the bell once", async () => {
    const stranger = await createUser("rq_from");
    const me = await createUser("rq_to");
    const id = await start(stranger, me);
    await send(stranger, id, "Hi, loved your answer on SIPs").expect(201);
    expect((await send(stranger, id, "Are you there?").expect(403)).body.error).toMatch(/accept/);

    expect(await inbox(me)).toEqual([]);
    const requests = await inbox(me, "requests");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ person: { username: stranger.username }, lastMessage: { text: "Hi, loved your answer on SIPs", mine: false }, unread: true });
    expect(await unread(me)).toEqual({ chats: 0, requests: 1 });

    const bell = (await api().get("/api/notifications").set("Authorization", me.auth).expect(200)).body.notifications;
    expect(bell.filter((n: { kind: string }) => n.kind === "message_request")).toHaveLength(1);
    expect(bell[0].message).toBe(`${stranger.username} sent you a message request`);

    // The sender sees it's waiting, and no "Seen" while it's a request even after it's opened
    await open(me, id);
    expect((await open(stranger, id)).conversation).toMatchObject({ waitingForThem: true, canSend: false, seenUpTo: null });

    // Replying accepts it
    await send(me, id, "Thanks!").expect(201);
    expect(await inbox(me, "requests")).toEqual([]);
    expect(await inbox(me)).toHaveLength(1);
    await send(stranger, id, "Great").expect(201);
  });

  it("lets people you follow or share a group with go straight to the inbox", async () => {
    const friend = await createUser("rq_friend");
    const me = await createUser("rq_me");
    await follow(me, friend);
    const id = await start(friend, me);
    await send(friend, id, "Hey").expect(201);
    await send(friend, id, "Lunch?").expect(201);
    expect(await inbox(me)).toHaveLength(1);
    expect(await unread(me)).toEqual({ chats: 1, requests: 0 });

    const flatmate = await createUser("rq_flat");
    const group = (await api().post("/api/shared/groups").set("Authorization", me.auth).send({ name: "Flat" }).expect(201)).body.group.id;
    const { member } = (await api().post(`/api/shared/groups/${group}/members`).set("Authorization", me.auth).send({ username: flatmate.username }).expect(201)).body;
    await api().post(`/api/shared/invites/${member.id}/accept`).set("Authorization", flatmate.auth).expect(200);
    const id2 = await start(flatmate, me);
    await send(flatmate, id2, "Rent is due").expect(201);
    expect((await inbox(me)).map((c: { id: string }) => c.id)).toContain(id2);
  });

  it("can accept a request without replying, or delete it", async () => {
    const s1 = await createUser("rq_s1");
    const s2 = await createUser("rq_s2");
    const me = await createUser("rq_mine");
    const one = await start(s1, me);
    const two = await start(s2, me);
    await send(s1, one, "Hello").expect(201);
    await send(s2, two, "Buy my course").expect(201);

    await api().post(`/api/chats/${one}/accept`).set("Authorization", me.auth).expect(200);
    await api().delete(`/api/chats/${two}`).set("Authorization", me.auth).expect(200);
    expect((await inbox(me)).map((c: { id: string }) => c.id)).toEqual([one]);
    expect(await inbox(me, "requests")).toEqual([]);
    expect(await unread(me)).toEqual({ chats: 0, requests: 0 });
    await send(s1, one, "Thanks for accepting").expect(201);
    await send(s2, two, "Hello??").expect(403);
  });
});

describe("in a chat", () => {
  it("shows Seen once the other person has opened the chat, and counts unread chats", async () => {
    const a = await createUser("in_a");
    const b = await createUser("in_b");
    await follow(b, a);
    const id = await start(a, b);
    const sent = (await send(a, id, "Did you pay the electricity bill?").expect(201)).body.message;
    expect((await open(a, id)).conversation.seenUpTo).toBeNull();
    expect(await unread(b)).toEqual({ chats: 1, requests: 0 });

    const seen = await open(b, id);
    expect(seen.messages.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual([["Did you pay the electricity bill?", false]]);
    expect(await unread(b)).toEqual({ chats: 0, requests: 0 });
    const view = (await open(a, id)).conversation;
    expect(new Date(view.seenUpTo).getTime()).toBeGreaterThanOrEqual(new Date(sent.createdAt).getTime());
  });

  it("lets the sender delete a message for both people at any time", async () => {
    const a = await createUser("un_a");
    const b = await createUser("un_b");
    await follow(b, a);
    const id = await start(a, b);
    const msg = (await send(a, id, "Wrong chat, sorry").expect(201)).body.message;
    await api().delete(`/api/chats/${id}/messages/${msg.id}`).set("Authorization", b.auth).expect(403);
    const gone = (await api().delete(`/api/chats/${id}/messages/${msg.id}`).set("Authorization", a.auth).expect(200)).body.message;
    expect(gone).toMatchObject({ deleted: true, body: "" });

    const theirs = await open(b, id);
    expect(theirs.messages[0]).toMatchObject({ deleted: true, body: "" });
    expect((await inbox(b))[0].lastMessage).toMatchObject({ text: "This message was deleted", deleted: true });
    expect(JSON.stringify(theirs)).not.toContain("Wrong chat");
  });

  it("deletes a chat only for you, and a new message brings it back from that message", async () => {
    const a = await createUser("dl_a");
    const b = await createUser("dl_b");
    await follow(b, a);
    const id = await start(a, b);
    await send(a, id, "Old message").expect(201);
    await api().delete(`/api/chats/${id}`).set("Authorization", b.auth).expect(200);
    expect(await inbox(b)).toEqual([]);
    expect(await inbox(a)).toHaveLength(1);

    await send(a, id, "New message").expect(201);
    expect(await inbox(b)).toHaveLength(1);
    expect((await open(b, id)).messages.map((m: { body: string }) => m.body)).toEqual(["New message"]);
    expect((await open(a, id)).messages.map((m: { body: string }) => m.body)).toEqual(["Old message", "New message"]);
  });

  it("pages back through older messages", async () => {
    const a = await createUser("pg_a");
    const b = await createUser("pg_b");
    await follow(b, a);
    const id = await start(a, b);
    for (let i = 1; i <= 55; i++) await send(a, id, `Message ${i}`).expect(201);
    const first = await open(a, id);
    expect(first.messages).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    expect(first.messages[0].body).toBe("Message 6");
    const older = (await api().get(`/api/chats/${id}`).query({ before: first.messages[0].createdAt }).set("Authorization", a.auth).expect(200)).body;
    expect(older.messages.map((m: { body: string }) => m.body)).toEqual(["Message 1", "Message 2", "Message 3", "Message 4", "Message 5"]);
    expect(older.hasMore).toBe(false);
  });
});

describe("when someone leaves", () => {
  it("keeps their messages as Deleted user, and no more can be sent", async () => {
    const leaving = await createUser("lv_gone");
    const staying = await createUser("lv_stay");
    await follow(staying, leaving);
    const id = await start(leaving, staying);
    await send(leaving, id, "Bye for now").expect(201);
    await send(staying, id, "Take care").expect(201);

    await api().delete("/api/account").set("Authorization", leaving.auth).send({ password: leaving.password }).expect(200);
    const view = await open(staying, id);
    expect(view.conversation).toMatchObject({ person: null, canSend: false, cannotSendReason: "This account has been deleted" });
    expect(view.messages.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual([
      ["Bye for now", false],
      ["Take care", true],
    ]);
    expect((await inbox(staying))[0].person).toBeNull();
    await send(staying, id, "Hello?").expect(403);
    expect(JSON.stringify(view)).not.toContain(leaving.username);
  });

  it("includes your chats in Download all your data", async () => {
    const a = await createUser("ex_a");
    const b = await createUser("ex_b");
    await follow(b, a);
    const id = await start(a, b);
    await send(a, id, "Exported hello").expect(201);
    await send(b, id, "Exported reply").expect(201);
    const data = (await api().get("/api/account/export").set("Authorization", a.auth).expect(200)).body.data;
    expect(data.messages).toEqual([
      {
        with: b.username,
        messages: [
          { from: "you", text: "Exported hello", sentAt: expect.any(String) },
          { from: b.username, text: "Exported reply", sentAt: expect.any(String) },
        ],
      },
    ]);
  });
});

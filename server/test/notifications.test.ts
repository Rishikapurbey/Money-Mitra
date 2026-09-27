import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import { sendEmail } from "../src/lib/email";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

beforeAll(resetDatabase);

async function ask(auth: string, title = "Is an SIP better than an FD?") {
  const res = await api().post("/api/posts").set("Authorization", auth).send({ title, topic: "Investing" }).expect(201);
  return res.body.post.id as string;
}
const reply = (auth: string, postId: string, body = "Here's my take", isAnonymous = false) =>
  api().post(`/api/posts/${postId}/replies`).set("Authorization", auth).send({ body, isAnonymous }).expect(201);
const inbox = async (auth: string) => (await api().get("/api/notifications").set("Authorization", auth).expect(200)).body;

describe("reply notifications", () => {
  it("tells the asker about a reply without ever naming the replier", async () => {
    const asker = await createUser("asker");
    const replier = await createUser("secretive");
    const postId = await ask(asker.auth);
    await reply(replier.auth, postId, "Anonymous answer", true);

    const { unread, notifications } = await inbox(asker.auth);
    expect(unread).toBe(1);
    expect(notifications[0]).toMatchObject({ kind: "reply_to_question", message: "New reply to your question", postId });
    expect(JSON.stringify(notifications)).not.toContain(replier.username);
    expect((await inbox(replier.auth)).unread).toBe(0);
  });

  it("does not notify people about their own replies", async () => {
    const user = await createUser("selfie");
    const postId = await ask(user.auth);
    await reply(user.auth, postId);
    expect((await inbox(user.auth)).unread).toBe(0);
  });

  it("groups unread replies and also tells earlier answerers", async () => {
    const asker = await createUser("asker");
    const first = await createUser("first");
    const second = await createUser("second");
    const postId = await ask(asker.auth);
    await reply(first.auth, postId);
    await reply(second.auth, postId);

    const askerInbox = await inbox(asker.auth);
    expect(askerInbox.unread).toBe(1);
    expect(askerInbox.notifications[0].message).toBe("2 new replies to your question");
    const firstInbox = await inbox(first.auth);
    expect(firstInbox.notifications[0]).toMatchObject({ kind: "reply_in_thread", message: "New reply in a discussion you joined" });
  });
});

describe("helpful and hidden notifications", () => {
  it("groups helpful votes and ignores un-votes", async () => {
    const asker = await createUser("asker");
    const answerer = await createUser("answerer");
    const voterA = await createUser("voter");
    const voterB = await createUser("voter");
    const postId = await ask(asker.auth);
    const replyId = (await reply(answerer.auth, postId)).body.reply.id;
    const vote = (auth: string) => api().post(`/api/posts/${postId}/replies/${replyId}/helpful`).set("Authorization", auth).expect(200);

    await vote(voterA.auth);
    await vote(voterB.auth);
    await vote(voterB.auth); // un-vote
    const helpful = (await inbox(answerer.auth)).notifications.filter((n: { kind: string }) => n.kind === "helpful");
    expect(helpful).toHaveLength(1);
    expect(helpful[0].message).toBe("2 people found your answer helpful");
  });

  it("tells the author once when their question is hidden", async () => {
    const author = await createUser("author");
    const postId = await ask(author.auth, "Get rich quick scheme here");
    for (let i = 0; i < 4; i++) {
      const reporter = await createUser("rep");
      await api().post(`/api/posts/${postId}/report`).set("Authorization", reporter.auth).send({ reason: "spam" }).expect(201);
    }
    const hidden = (await inbox(author.auth)).notifications.filter((n: { kind: string }) => n.kind === "post_hidden");
    expect(hidden).toHaveLength(1);
  });
});

describe("reading notifications", () => {
  it("marks one, a whole discussion, or everything as read", async () => {
    const asker = await createUser("reader");
    const other = await createUser("other");
    const postA = await ask(asker.auth, "First question here");
    const postB = await ask(asker.auth, "Second question here");
    const postC = await ask(asker.auth, "Third question here");
    await reply(other.auth, postA);
    await reply(other.auth, postB);
    await reply(other.auth, postC);
    expect((await inbox(asker.auth)).unread).toBe(3);

    const firstId = (await inbox(asker.auth)).notifications.find((n: { postId: string }) => n.postId === postA).id;
    await api().post(`/api/notifications/${firstId}/read`).set("Authorization", asker.auth).expect(200);
    await api().post(`/api/notifications/posts/${postB}/read`).set("Authorization", asker.auth).expect(200);
    expect((await api().get("/api/notifications/unread-count").set("Authorization", asker.auth)).body.unread).toBe(1);

    await api().post("/api/notifications/read-all").set("Authorization", asker.auth).expect(200);
    expect((await inbox(asker.auth)).unread).toBe(0);
    await api().post(`/api/notifications/${firstId}/read`).set("Authorization", other.auth).expect(404);
  });
});

describe("reply emails", () => {
  it("emails the asker at most once an hour per question, and respects the setting", async () => {
    vi.mocked(sendEmail).mockClear();
    const asker = await createUser("mailme");
    const other = await createUser("other");
    const postId = await ask(asker.auth, "Question <with> html");
    await reply(other.auth, postId);
    await api().post("/api/notifications/read-all").set("Authorization", asker.auth);
    await reply(other.auth, postId); // new notification row, but within the hour: no second email

    const emails = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(asker.email);
    expect(emails[0].html).toContain("Question &lt;with&gt; html");

    const quiet = await createUser("quiet");
    await api().put("/api/account/email-preferences").set("Authorization", quiet.auth).send({ emailReplies: false }).expect(200);
    const quietPost = await ask(quiet.auth);
    await reply(other.auth, quietPost);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
    expect((await inbox(quiet.auth)).unread).toBe(1);
  });
});

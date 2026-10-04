import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const ask = async (user: User, body: Record<string, unknown>) =>
  (await api().post("/api/posts").set("Authorization", user.auth).send({ topic: "Saving", ...body }).expect(201)).body.post;
const reply = async (user: User, postId: string, body: string, isAnonymous = false) =>
  (await api().post(`/api/posts/${postId}/replies`).set("Authorization", user.auth).send({ body, isAnonymous }).expect(201)).body.reply;
const search = async (user: User, q: string) =>
  (await api().get("/api/posts").set("Authorization", user.auth).query({ q }).expect(200)).body.posts as { id: string; title: string }[];
const accept = (user: User, postId: string, replyId: string | null) =>
  api().put(`/api/posts/${postId}/accepted`).set("Authorization", user.auth).send({ replyId });
const reportReply = async (postId: string, replyId: string) => {
  for (let i = 0; i < 3; i++) {
    const reporter = await createUser("reporter");
    await api().post(`/api/posts/${postId}/replies/${replyId}/report`).set("Authorization", reporter.auth).send({ reason: "spam" }).expect(201);
  }
};

describe("Discuss search", () => {
  it("matches titles, details and replies, ignoring case", async () => {
    const user = await createUser("searcher");
    const byTitle = await ask(user, { title: "Is a recurring deposit worth it?" });
    const byBody = await ask(user, { title: "Where should I keep savings?", body: "Thinking about a liquid fund" });
    const byReply = await ask(user, { title: "Short-term parking for cash?" });
    await reply(user, byReply.id, "A sweep-in FD works well for this");
    await ask(user, { title: "Unrelated question here" });

    expect((await search(user, "RECURRING")).map((p) => p.id)).toEqual([byTitle.id]);
    expect((await search(user, "liquid fund")).map((p) => p.id)).toEqual([byBody.id]);
    expect((await search(user, "sweep-in")).map((p) => p.id)).toEqual([byReply.id]);
    await api().get("/api/posts").set("Authorization", user.auth).query({ q: "x".repeat(101) }).expect(400);
  });

  it("doesn't find questions through replies hidden after reports", async () => {
    const user = await createUser("hider");
    const post = await ask(user, { title: "A perfectly normal question" });
    const spam = await reply(await createUser("spammer"), post.id, "Buy zqxcoin now");
    expect(await search(user, "zqxcoin")).toHaveLength(1);
    await reportReply(post.id, spam.id);
    expect(await search(user, "zqxcoin")).toHaveLength(0);
  });
});

describe("accepted answers", () => {
  it("lets only the asker accept a reply, shows it first, and tells the reply's author", async () => {
    const asker = await createUser("asker");
    const helper = await createUser("helper");
    const other = await createUser("other");
    const post = await ask(asker, { title: "How big should an emergency fund be?", isAnonymous: true });
    const first = await reply(other, post.id, "Three months maybe");
    const best = await reply(helper, post.id, "Six months of expenses");

    await accept(other, post.id, best.id).expect(404);
    await accept(asker, post.id, "not-a-reply").expect(404);
    expect((await accept(asker, post.id, best.id).expect(200)).body).toEqual({ acceptedReplyId: best.id });

    const thread = (await api().get(`/api/posts/${post.id}`).set("Authorization", other.auth).expect(200)).body.post;
    expect(thread.answered).toBe(true);
    expect(thread.replies.map((r: { id: string; accepted: boolean }) => [r.id, r.accepted])).toEqual([
      [best.id, true],
      [first.id, false],
    ]);
    // Accepting on an anonymous question still doesn't reveal who asked
    expect(JSON.stringify(thread)).not.toContain(asker.username);

    const list = (await api().get("/api/posts").set("Authorization", other.auth).expect(200)).body.posts;
    expect(list.find((p: { id: string }) => p.id === post.id).answered).toBe(true);

    const bell = (await api().get("/api/notifications").set("Authorization", helper.auth).expect(200)).body.notifications;
    expect(bell[0]).toMatchObject({ kind: "answer_accepted", message: "Your reply was marked as the answer", postId: post.id });
  });

  it("can be changed or cleared, and is cleared when the reply is deleted", async () => {
    const asker = await createUser("changer");
    const helper = await createUser("helper2");
    const post = await ask(asker, { title: "Switching banks for a better rate?" });
    const a = await reply(helper, post.id, "Yes if the gap is big");
    const b = await reply(helper, post.id, "Check the fees first");

    await accept(asker, post.id, a.id).expect(200);
    await accept(asker, post.id, b.id).expect(200);
    await accept(asker, post.id, null).expect(200);
    let thread = (await api().get(`/api/posts/${post.id}`).set("Authorization", asker.auth)).body.post;
    expect(thread.answered).toBe(false);

    await accept(asker, post.id, a.id).expect(200);
    await api().delete(`/api/posts/${post.id}/replies/${a.id}`).set("Authorization", helper.auth).expect(200);
    thread = (await api().get(`/api/posts/${post.id}`).set("Authorization", asker.auth)).body.post;
    expect(thread.answered).toBe(false);
  });

  it("won't accept a hidden reply, and a reply hidden later stops counting", async () => {
    const asker = await createUser("strict");
    const post = await ask(asker, { title: "Is gold a good investment?" });
    const r = await reply(await createUser("goldbug"), post.id, "Always buy gold");
    await accept(asker, post.id, r.id).expect(200);
    await reportReply(post.id, r.id);
    const thread = (await api().get(`/api/posts/${post.id}`).set("Authorization", asker.auth)).body.post;
    expect(thread.answered).toBe(false);
    await accept(asker, post.id, r.id).expect(404);
  });

  it("counts on profiles, but never for anonymous replies", async () => {
    const asker = await createUser("pasker");
    const helper = await createUser("phelper");
    const p1 = await ask(asker, { title: "First question about PPF" });
    const p2 = await ask(asker, { title: "Second question about EPF" });
    await accept(asker, p1.id, (await reply(helper, p1.id, "Named answer")).id).expect(200);
    await accept(asker, p2.id, (await reply(helper, p2.id, "Anonymous answer", true)).id).expect(200);

    const profile = (await api().get(`/api/users/${helper.username}`).set("Authorization", asker.auth).expect(200)).body.profile;
    expect(profile.activity.acceptedCount).toBe(1);
    expect(profile.activity.replies).toEqual([expect.objectContaining({ body: "Named answer", accepted: true })]);
  });
});

describe("my activity", () => {
  it("lists the user's own questions and replies, anonymous ones included, with totals", async () => {
    const me = await createUser("me");
    const other = await createUser("someone");
    const mine = await ask(me, { title: "My anonymous question", isAnonymous: true });
    const theirs = await ask(other, { title: "Their question" });
    const myReply = await reply(me, theirs.id, "My helpful reply");
    await api().post(`/api/posts/${theirs.id}/replies/${myReply.id}/helpful`).set("Authorization", other.auth).expect(200);
    await accept(other, theirs.id, myReply.id).expect(200);

    const activity = (await api().get("/api/posts/activity").set("Authorization", me.auth).expect(200)).body;
    expect(activity.totals).toEqual({ questions: 1, replies: 1, helpful: 1, accepted: 1 });
    expect(activity.questions).toEqual([expect.objectContaining({ id: mine.id, isAnonymous: true, answered: false, replyCount: 0 })]);
    expect(activity.replies).toEqual([
      expect.objectContaining({ id: myReply.id, postId: theirs.id, postTitle: "Their question", helpfulCount: 1, accepted: true }),
    ]);

    const theirActivity = (await api().get("/api/posts/activity").set("Authorization", other.auth).expect(200)).body;
    expect(JSON.stringify(theirActivity)).not.toContain("My anonymous question");
  });
});

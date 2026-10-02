import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import { sendEmail } from "../src/lib/email";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

beforeAll(async () => {
  process.env.ADMIN_EMAIL = "admin@example.com";
  await resetDatabase();
});

async function question(auth: string, title = "How do I start an SIP?") {
  const res = await api().post("/api/posts").set("Authorization", auth).send({ title, topic: "Investing" }).expect(201);
  return res.body.post.id as string;
}

async function reply(auth: string, postId: string, body: string) {
  const res = await api().post(`/api/posts/${postId}/replies`).set("Authorization", auth).send({ body }).expect(201);
  return res.body.reply.id as string;
}

describe("helpful votes", () => {
  it("toggles one vote per person and sorts the most helpful reply first", async () => {
    const asker = await createUser("asker");
    const a = await createUser("ans_a");
    const b = await createUser("ans_b");
    const postId = await question(asker.auth);
    await reply(a.auth, postId, "First answer");
    const second = await reply(b.auth, postId, "Second answer");

    const vote = () => api().post(`/api/posts/${postId}/replies/${second}/helpful`).set("Authorization", asker.auth);
    expect((await vote()).body).toEqual({ helpfulCount: 1, votedByMe: true });
    expect((await vote()).body).toEqual({ helpfulCount: 0, votedByMe: false });
    await vote();

    const replies = (await api().get(`/api/posts/${postId}`).set("Authorization", a.auth)).body.post.replies;
    expect(replies[0].body).toBe("Second answer");
    expect(replies[0].helpfulCount).toBe(1);
    expect(replies[0].votedByMe).toBe(false);
  });

  it("does not allow voting for your own reply", async () => {
    const user = await createUser("self");
    const postId = await question(user.auth);
    const replyId = await reply(user.auth, postId, "Answering myself");
    await api().post(`/api/posts/${postId}/replies/${replyId}/helpful`).set("Authorization", user.auth).expect(400);
  });
});

describe("unanswered filter", () => {
  it("only lists questions without replies", async () => {
    const user = await createUser("unans");
    const helper = await createUser("helper");
    const answered = await question(user.auth, "Answered question here");
    await reply(helper.auth, answered, "Here you go");
    const open = await question(user.auth, "Still waiting for help");

    const ids = (await api().get("/api/posts?unanswered=1").set("Authorization", user.auth)).body.posts.map((p: { id: string }) => p.id);
    expect(ids).toContain(open);
    expect(ids).not.toContain(answered);
  });
});

describe("reports", () => {
  it("rejects bad reasons, self-reports and duplicates", async () => {
    const author = await createUser("author");
    const reporter = await createUser("reporter");
    const postId = await question(author.auth);
    await api().post(`/api/posts/${postId}/report`).set("Authorization", reporter.auth).send({ reason: "boring" }).expect(400);
    await api().post(`/api/posts/${postId}/report`).set("Authorization", author.auth).send({ reason: "spam" }).expect(400);
    await api().post(`/api/posts/${postId}/report`).set("Authorization", reporter.auth).send({ reason: "spam" }).expect(201);
    await api().post(`/api/posts/${postId}/report`).set("Authorization", reporter.auth).send({ reason: "spam" }).expect(409);
  });

  it("hides a question after 3 reports and emails the admin with escaped content", async () => {
    vi.mocked(sendEmail).mockClear();
    const author = await createUser("spammer");
    const postId = await question(author.auth, "<b>Buy cheap coins now</b>");

    for (let i = 0; i < 3; i++) {
      const reporter = await createUser("rep");
      const res = await api().post(`/api/posts/${postId}/report`).set("Authorization", reporter.auth).send({ reason: "spam" });
      expect(res.body.hidden).toBe(i === 2);
    }

    const viewer = await createUser("viewer");
    const list = (await api().get("/api/posts").set("Authorization", viewer.auth)).body.posts;
    expect(list.map((p: { id: string }) => p.id)).not.toContain(postId);
    const detail = (await api().get(`/api/posts/${postId}`).set("Authorization", viewer.auth)).body.post;
    expect(detail).toMatchObject({ hidden: true, title: "", body: "", author: null });

    // Signups in between send confirmation emails; only the admin's matter here
    const emails = vi.mocked(sendEmail).mock.calls.map((c) => c[0]).filter((e) => e.to === "admin@example.com");
    expect(emails).toHaveLength(3);
    expect(emails[2].html).toContain("&lt;b&gt;Buy cheap coins now&lt;/b&gt;");
    expect(emails[2].html).not.toContain("<b>Buy cheap");
  });

  it("hides a reported reply but keeps the rest of the thread", async () => {
    const asker = await createUser("asker");
    const troll = await createUser("troll");
    const postId = await question(asker.auth);
    const replyId = await reply(troll.auth, postId, "Rude reply");
    for (let i = 0; i < 3; i++) {
      const reporter = await createUser("rep");
      await api().post(`/api/posts/${postId}/replies/${replyId}/report`).set("Authorization", reporter.auth).send({ reason: "abusive" }).expect(201);
    }
    const post = (await api().get(`/api/posts/${postId}`).set("Authorization", asker.auth)).body.post;
    expect(post.hidden).toBe(false);
    expect(post.replies[0]).toMatchObject({ hidden: true, body: "", author: null });
    await api().post(`/api/posts/${postId}/replies/${replyId}/helpful`).set("Authorization", asker.auth).expect(404);
  });
});

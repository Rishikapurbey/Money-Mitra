import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

describe("Discuss anonymity", () => {
  it("never reveals the author of anonymous posts and replies to others", async () => {
    const author = await createUser("author");
    const reader = await createUser("reader");

    const post = await api()
      .post("/api/posts")
      .set("Authorization", author.auth)
      .send({ title: "Is an SIP better than an FD?", topic: "Investing", isAnonymous: true })
      .expect(201);
    const id = post.body.post.id;
    await api().post(`/api/posts/${id}/replies`).set("Authorization", author.auth).send({ body: "Following", isAnonymous: true }).expect(201);

    for (const res of [
      await api().get(`/api/posts/${id}`).set("Authorization", reader.auth),
      await api().get("/api/posts").set("Authorization", reader.auth),
    ]) {
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(author.username);
      expect(text).not.toContain("authorId");
    }
    const seen = (await api().get(`/api/posts/${id}`).set("Authorization", reader.auth)).body.post;
    expect(seen.author).toBeNull();
    expect(seen.isMine).toBe(false);
    expect(seen.replies[0].author).toBeNull();

    const own = (await api().get(`/api/posts/${id}`).set("Authorization", author.auth)).body.post;
    expect(own.isMine).toBe(true);
  });

  it("only lets authors delete their own posts", async () => {
    const author = await createUser("author");
    const other = await createUser("other");
    const post = await api().post("/api/posts").set("Authorization", author.auth).send({ title: "Budgeting tips?", topic: "Budgeting" }).expect(201);
    await api().delete(`/api/posts/${post.body.post.id}`).set("Authorization", other.auth).expect(404);
    await api().delete(`/api/posts/${post.body.post.id}`).set("Authorization", author.auth).expect(200);
  });
});

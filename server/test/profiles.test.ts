import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

// A real 1x1 JPEG, as the app would upload after resizing
const JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function post(auth: string, title: string, isAnonymous = false) {
  const res = await api().post("/api/posts").set("Authorization", auth).send({ title, topic: "Saving", isAnonymous }).expect(201);
  return res.body.post.id as string;
}

describe("profiles", () => {
  it("never shows another person's money data or email", async () => {
    const owner = await createUser("owner");
    const viewer = await createUser("viewer");
    await api()
      .post("/api/transactions")
      .set("Authorization", owner.auth)
      .send({ amount: 987654, type: "income", category: "Salary", note: "secret-bonus-note" });
    await api().post("/api/goals").set("Authorization", owner.auth).send({ name: "secret-goal-name", targetAmount: 50000 });
    await post(owner.auth, "How do I start an emergency fund?");

    const res = await api().get(`/api/users/${owner.username}`).set("Authorization", viewer.auth).expect(200);
    const text = JSON.stringify(res.body);
    for (const secret of ["987654", "secret-bonus-note", "secret-goal-name", "Salary", owner.email, "passwordHash", "tokenVersion"]) {
      expect(text).not.toContain(secret);
    }
    expect(res.body.profile.activity.questions[0].title).toBe("How do I start an emergency fund?");
  });

  it("leaves anonymous posts and replies out of the profile and its counts", async () => {
    const author = await createUser("anon");
    const other = await createUser("other");
    const named = await post(author.auth, "Named question here");
    const secret = await post(author.auth, "Anonymous question here", true);
    await api().post(`/api/posts/${named}/replies`).set("Authorization", author.auth).send({ body: "anonymous-reply-text", isAnonymous: true });
    const reply = await api().post(`/api/posts/${secret}/replies`).set("Authorization", author.auth).send({ body: "named reply" }).expect(201);
    await api().post(`/api/posts/${secret}/replies/${reply.body.reply.id}/helpful`).set("Authorization", other.auth).expect(200);

    for (const viewer of [other, author]) {
      const { profile } = (await api().get(`/api/users/${author.username}`).set("Authorization", viewer.auth).expect(200)).body;
      expect(profile.activity.questionCount).toBe(1);
      expect(profile.activity.replyCount).toBe(1);
      expect(profile.activity.helpfulCount).toBe(1);
      // The anonymous question never appears as theirs; their named reply on it is public in that thread anyway
      expect(profile.activity.questions.map((q: { title: string }) => q.title)).toEqual(["Named question here"]);
      expect(profile.activity.replies.map((r: { body: string }) => r.body)).toEqual(["named reply"]);
      expect(JSON.stringify(profile)).not.toContain("anonymous-reply-text");
    }
  });

  it("hides a private profile's activity from everyone but its owner", async () => {
    const owner = await createUser("private");
    const viewer = await createUser("viewer");
    await post(owner.auth, "A question from a private person");
    await api().put("/api/account/privacy").set("Authorization", owner.auth).send({ isPrivate: true }).expect(200);

    const seen = (await api().get(`/api/users/${owner.username}`).set("Authorization", viewer.auth).expect(200)).body.profile;
    expect(seen.activity).toBeNull();
    expect(seen.isPrivate).toBe(true);
    expect(JSON.stringify(seen)).not.toContain("A question from a private person");

    const own = (await api().get(`/api/users/${owner.username}`).set("Authorization", owner.auth).expect(200)).body.profile;
    expect(own.activity.questionCount).toBe(1);
  });

  it("needs a login and 404s for unknown and deleted users", async () => {
    const user = await createUser("lookup");
    await api().get(`/api/users/${user.username}`).expect(401);
    await api().get("/api/users/nobody_here_at_all").set("Authorization", user.auth).expect(404);
    await api().get("/api/users/deleted_user").set("Authorization", user.auth).expect(404);
    // Addresses typed by hand needn't match the capitals
    await api().get(`/api/users/${user.username.toUpperCase()}`).set("Authorization", user.auth).expect(200);
  });
});

describe("editing your profile", () => {
  it("saves a name and bio, shown in Discuss, and clears them when empty", async () => {
    const user = await createUser("editor");
    const res = await api()
      .put("/api/account/profile")
      .set("Authorization", user.auth)
      .send({ displayName: "  Priya   Sharma ", bio: "Learning to invest." })
      .expect(200);
    expect(res.body.profile).toEqual({ displayName: "Priya Sharma", bio: "Learning to invest." });

    const id = await post(user.auth, "Named with a display name");
    const seen = (await api().get(`/api/posts/${id}`).set("Authorization", user.auth)).body.post;
    expect(seen.profile).toMatchObject({ username: user.username, displayName: "Priya Sharma" });

    await api().put("/api/account/profile").set("Authorization", user.auth).send({ displayName: "", bio: "" }).expect(200);
    const me = (await api().get("/api/auth/me").set("Authorization", user.auth)).body.user;
    expect(me.displayName).toBeNull();
    expect(me.bio).toBeNull();
  });

  it("rejects names that pass for someone else and overlong bios", async () => {
    const user = await createUser("badname");
    const send = (body: object) => api().put("/api/account/profile").set("Authorization", user.auth).send(body);
    await send({ displayName: "Anonymous" }).expect(400);
    await send({ displayName: "Money Mitra" }).expect(400);
    await send({ displayName: "Deleted user" }).expect(400);
    await send({ displayName: "x".repeat(41) }).expect(400);
    await send({ displayName: "Hidden​name" }).expect(400);
    await send({ bio: "x".repeat(161) }).expect(400);
  });

  it("never gives a profile to anonymous posts", async () => {
    const user = await createUser("anonpost");
    const id = await post(user.auth, "Anonymous with a profile", true);
    const other = await createUser("reader");
    const seen = (await api().get(`/api/posts/${id}`).set("Authorization", other.auth)).body.post;
    expect(seen.profile).toBeNull();
    expect(JSON.stringify(seen)).not.toContain(user.username);
  });
});

describe("profile photo", () => {
  it("uploads, serves and removes a photo", async () => {
    const user = await createUser("photo");
    const res = await api().put("/api/account/photo").set("Authorization", user.auth).send({ image: JPEG }).expect(200);
    const url: string = res.body.avatarUrl;
    expect(url).toMatch(new RegExp(`^/users/${user.username}/avatar\\?v=\\d+$`));

    // Served without a login, so <img> tags on the website can load it
    const image = await api().get(`/api${url}`).expect(200);
    expect(image.headers["content-type"]).toBe("image/jpeg");
    expect(image.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect((await api().get("/api/auth/me").set("Authorization", user.auth)).body.user.avatarUrl).toBe(url);

    await api().delete("/api/account/photo").set("Authorization", user.auth).expect(200);
    await api().get(`/api${url}`).expect(404);
    expect((await api().get("/api/auth/me").set("Authorization", user.auth)).body.user.avatarUrl).toBeNull();
  });

  it("rejects files that aren't photos or are too large", async () => {
    const user = await createUser("badphoto");
    const send = (image: unknown) => api().put("/api/account/photo").set("Authorization", user.auth).send({ image });
    await send("not a data url").expect(400);
    await send(`data:image/gif;base64,${Buffer.from("GIF89a").toString("base64")}`).expect(400);
    await send(`data:image/jpeg;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`).expect(400);
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(71 * 1024)]);
    await send(`data:image/jpeg;base64,${big.toString("base64")}`).expect(400);
  });

  it("moves the photo address along with a username change", async () => {
    const user = await createUser("rename");
    await api().put("/api/account/photo").set("Authorization", user.auth).send({ image: JPEG }).expect(200);
    const renamed = `${user.username}_x`.slice(0, 20);
    const res = await api().put("/api/account/username").set("Authorization", user.auth).send({ username: renamed }).expect(200);
    await api().get(`/api${res.body.user.avatarUrl}`).expect(200);
  });
});

describe("privacy settings", () => {
  it("saves each setting on its own and validates input", async () => {
    const user = await createUser("privacy");
    const send = (body: object) => api().put("/api/account/privacy").set("Authorization", user.auth).send(body);
    expect((await send({ anonymousByDefault: true }).expect(200)).body).toEqual({ isPrivate: false, anonymousByDefault: true });
    expect((await send({ isPrivate: true }).expect(200)).body).toEqual({ isPrivate: true, anonymousByDefault: true });
    await send({}).expect(400);
    await send({ isPrivate: "yes" }).expect(400);
  });
});

describe("profile cover", () => {
  const profileOf = async (user: Awaited<ReturnType<typeof createUser>>) =>
    (await api().get(`/api/users/${user.username}`).set("Authorization", user.auth).expect(200)).body.profile;

  it("uploads a cover image, swaps it for a built-in design, and goes back to the default", async () => {
    const user = await createUser("cover");
    expect(await profileOf(user)).toMatchObject({ coverUrl: null, coverPreset: null });

    // Covers may be larger than profile photos
    const wide = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(150 * 1024)]);
    const res = await api().put("/api/account/cover").set("Authorization", user.auth).send({ image: `data:image/jpeg;base64,${wide.toString("base64")}` }).expect(200);
    expect(res.body.coverUrl).toMatch(new RegExp(`^/users/${user.username}/cover\\?v=\\d+$`));
    const image = await api().get(`/api${res.body.coverUrl}`).expect(200);
    expect(image.headers["content-type"]).toBe("image/jpeg");
    expect((await profileOf(user)).coverUrl).toBe(res.body.coverUrl);
    expect((await api().get("/api/auth/me").set("Authorization", user.auth)).body.user).toMatchObject({ coverUrl: res.body.coverUrl, coverPreset: null });

    await api().put("/api/account/cover/preset").set("Authorization", user.auth).send({ preset: "navy" }).expect(200);
    expect(await profileOf(user)).toMatchObject({ coverUrl: null, coverPreset: "navy" });
    await api().get(`/api${res.body.coverUrl}`).expect(404);

    await api().delete("/api/account/cover").set("Authorization", user.auth).expect(200);
    expect(await profileOf(user)).toMatchObject({ coverUrl: null, coverPreset: null });
  });

  it("rejects unknown designs, non-images and covers that are too large", async () => {
    const user = await createUser("badcover");
    await api().put("/api/account/cover/preset").set("Authorization", user.auth).send({ preset: "rainbow" }).expect(400);
    await api().put("/api/account/cover").set("Authorization", user.auth).send({ image: "nope" }).expect(400);
    const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(201 * 1024)]);
    await api().put("/api/account/cover").set("Authorization", user.auth).send({ image: `data:image/jpeg;base64,${huge.toString("base64")}` }).expect(400);
    await api().put("/api/account/cover").send({ image: JPEG }).expect(401);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const followUser = (from: User, to: User) => api().post(`/api/follows/${to.username}`).set("Authorization", from.auth);
const profileOf = async (viewer: User, of: User) =>
  (await api().get(`/api/users/${of.username}`).set("Authorization", viewer.auth).expect(200)).body.profile;
const inbox = async (user: User) => (await api().get("/api/notifications").set("Authorization", user.auth).expect(200)).body.notifications;
const makePrivate = (user: User, isPrivate = true) =>
  api().put("/api/account/privacy").set("Authorization", user.auth).send({ isPrivate }).expect(200);
const ask = async (user: User, title: string, isAnonymous = false) =>
  (await api().post("/api/posts").set("Authorization", user.auth).send({ title, topic: "Saving", isAnonymous }).expect(201)).body.post.id;

describe("following a public profile", () => {
  it("follows straight away, counts it, tells them, and can be undone", async () => {
    const fan = await createUser("fan");
    const star = await createUser("star");
    expect((await followUser(fan, star).expect(200)).body.followStatus).toBe("following");
    // Following twice changes nothing
    expect((await followUser(fan, star).expect(200)).body.followStatus).toBe("following");

    const seen = await profileOf(fan, star);
    expect(seen).toMatchObject({ followStatus: "following", followerCount: 1, followingCount: 0, followsYou: false });
    expect((await profileOf(star, fan)).followsYou).toBe(true);
    expect((await profileOf(fan, fan)).followingCount).toBe(1);

    const [n] = await inbox(star);
    expect(n).toMatchObject({ kind: "new_follower", postId: null, actor: { username: fan.username } });
    expect(n.message).toBe(`${fan.username} started following you`);

    await api().delete(`/api/follows/${star.username}`).set("Authorization", fan.auth).expect(200);
    expect(await profileOf(fan, star)).toMatchObject({ followStatus: "none", followerCount: 0 });
  });

  it("can't follow yourself, unknown people or deleted accounts", async () => {
    const user = await createUser("self");
    await followUser(user, user).expect(400);
    await api().post("/api/follows/nobody_like_this").set("Authorization", user.auth).expect(404);
    await api().post("/api/follows/deleted_user").set("Authorization", user.auth).expect(404);
    await api().post(`/api/follows/${user.username}`).expect(401);
  });
});

describe("following a private profile", () => {
  it("sends a request; only an accepted follower sees the activity and lists", async () => {
    const owner = await createUser("owner");
    const asker = await createUser("asker");
    await ask(owner, "A question from a private profile");
    await makePrivate(owner);

    expect((await followUser(asker, owner).expect(200)).body.followStatus).toBe("requested");
    const waiting = await profileOf(asker, owner);
    expect(waiting).toMatchObject({ followStatus: "requested", followerCount: 0, activity: null });
    await api().get(`/api/users/${owner.username}/followers`).set("Authorization", asker.auth).expect(403);
    await api().get(`/api/users/${owner.username}/following`).set("Authorization", asker.auth).expect(403);

    expect((await profileOf(owner, owner)).pendingRequests).toBe(1);
    const requests = (await api().get("/api/follows/requests").set("Authorization", owner.auth).expect(200)).body.requests;
    expect(requests.map((r: { username: string }) => r.username)).toEqual([asker.username]);
    expect((await inbox(owner))[0]).toMatchObject({ kind: "follow_request", actor: { username: asker.username } });

    await api().post(`/api/follows/requests/${asker.username}/accept`).set("Authorization", owner.auth).expect(200);
    const accepted = await profileOf(asker, owner);
    expect(accepted.followStatus).toBe("following");
    expect(accepted.activity.questions[0].title).toBe("A question from a private profile");
    await api().get(`/api/users/${owner.username}/followers`).set("Authorization", asker.auth).expect(200);
    // The answered request leaves the owner's bell; the asker hears it was accepted
    expect((await inbox(owner)).some((n: { kind: string }) => n.kind === "follow_request")).toBe(false);
    expect((await inbox(asker))[0]).toMatchObject({ kind: "follow_accepted", actor: { username: owner.username } });
    await api().post(`/api/follows/requests/${asker.username}/accept`).set("Authorization", owner.auth).expect(404);
  });

  it("lets the owner decline, and the asker withdraw, a request", async () => {
    const owner = await createUser("owner");
    const first = await createUser("first");
    const second = await createUser("second");
    await makePrivate(owner);
    await followUser(first, owner).expect(200);
    await followUser(second, owner).expect(200);

    await api().delete(`/api/follows/requests/${first.username}`).set("Authorization", owner.auth).expect(200);
    expect((await profileOf(first, owner)).followStatus).toBe("none");

    await api().delete(`/api/follows/${owner.username}`).set("Authorization", second.auth).expect(200);
    expect((await api().get("/api/follows/requests").set("Authorization", owner.auth)).body.requests).toEqual([]);
    expect((await inbox(owner)).filter((n: { kind: string }) => n.kind === "follow_request")).toEqual([]);
  });

  it("lets everyone waiting in when the profile goes public", async () => {
    const owner = await createUser("owner");
    const fan = await createUser("fan");
    await makePrivate(owner);
    await followUser(fan, owner).expect(200);
    await makePrivate(owner, false);
    expect((await profileOf(fan, owner)).followStatus).toBe("following");
    expect((await inbox(fan))[0].kind).toBe("follow_accepted");
  });

  it("keeps existing followers when a profile goes private", async () => {
    const owner = await createUser("owner");
    const fan = await createUser("fan");
    await followUser(fan, owner).expect(200);
    await makePrivate(owner);
    expect((await profileOf(fan, owner)).activity).not.toBeNull();
  });
});

describe("removing a follower", () => {
  it("stops them following, and they then see a private profile as a stranger", async () => {
    const owner = await createUser("owner");
    const fan = await createUser("fan");
    await followUser(fan, owner).expect(200);
    await makePrivate(owner);
    await api().delete(`/api/follows/followers/${fan.username}`).set("Authorization", owner.auth).expect(200);
    expect(await profileOf(fan, owner)).toMatchObject({ followStatus: "none", activity: null });
  });
});

describe("follower lists", () => {
  it("show identity only, with the viewer's own follow status for each person", async () => {
    const star = await createUser("star");
    const fanA = await createUser("fana");
    const fanB = await createUser("fanb");
    const viewer = await createUser("viewer");
    await followUser(fanA, star).expect(200);
    await followUser(fanB, star).expect(200);
    await followUser(viewer, fanA).expect(200);
    await followUser(viewer, star).expect(200);

    const { people } = (await api().get(`/api/users/${star.username}/followers`).set("Authorization", viewer.auth).expect(200)).body;
    const byName = Object.fromEntries(people.map((p: { username: string }) => [p.username, p]));
    expect(byName[fanA.username]).toMatchObject({ followStatus: "following", isMe: false });
    expect(byName[fanB.username]).toMatchObject({ followStatus: "none" });
    expect(byName[viewer.username]).toMatchObject({ isMe: true });
    const text = JSON.stringify(people);
    for (const user of [star, fanA, fanB, viewer]) expect(text).not.toContain(user.email);
    expect(text).not.toContain('"id"');
  });
});

describe("questions from people you follow", () => {
  it("appear in the Following feed and the bell, but never anonymous ones", async () => {
    const fan = await createUser("fan");
    const star = await createUser("star");
    const stranger = await createUser("stranger");
    await followUser(fan, star).expect(200);

    const named = await ask(star, "Named question from someone I follow");
    await ask(star, "Anonymous question from someone I follow", true);
    await ask(stranger, "A question from a stranger");

    const feed = (await api().get("/api/posts?following=1").set("Authorization", fan.auth).expect(200)).body.posts;
    expect(feed.map((p: { title: string }) => p.title)).toEqual(["Named question from someone I follow"]);

    const bell = await inbox(fan);
    expect(bell).toHaveLength(1);
    expect(bell[0]).toMatchObject({ kind: "followed_post", postId: named, title: "Named question from someone I follow" });
    expect(JSON.stringify(bell)).not.toContain("Anonymous question");
  });

  it("don't reach people whose request is still waiting", async () => {
    const owner = await createUser("owner");
    const asker = await createUser("asker");
    await makePrivate(owner);
    await followUser(asker, owner).expect(200);
    await ask(owner, "Private person asks something");
    expect((await api().get("/api/posts?following=1").set("Authorization", asker.auth)).body.posts).toEqual([]);
    expect(await inbox(asker)).toEqual([]);
  });
});

describe("deleting an account", () => {
  it("removes its follows and the notifications it caused", async () => {
    const leaver = await createUser("leaver");
    const star = await createUser("star");
    await followUser(leaver, star).expect(200);
    await followUser(star, leaver).expect(200);
    await api().delete("/api/account").set("Authorization", leaver.auth).send({ password: leaver.password }).expect(200);
    expect(await profileOf(star, star)).toMatchObject({ followerCount: 0, followingCount: 0 });
    expect(await inbox(star)).toEqual([]);
  });
});

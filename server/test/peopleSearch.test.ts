import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;
type Person = { username: string; displayName: string | null; avatarUrl: string | null; inGroup: string | null };

const newGroup = async (owner: User) =>
  (await api().post("/api/shared/groups").set("Authorization", owner.auth).send({ name: "Flat" }).expect(201)).body.group.id as string;
const search = async (user: User, groupId: string, q: string) =>
  (await api().get(`/api/shared/groups/${groupId}/people`).query({ q }).set("Authorization", user.auth).expect(200)).body.people as Person[];
const names = (people: Person[]) => people.map((p) => p.username);

describe("searching for people to invite", () => {
  it("starts at three characters and matches the start of a username or of a word in the name", async () => {
    const owner = await createUser("srcha");
    const id = await newGroup(owner);
    const byName = await createUser("qqname");
    await prisma.user.update({ where: { username: byName.username }, data: { displayName: "Asha Pmxkumar" } });
    const one = await createUser("pmxone");

    expect(await search(owner, id, "pm")).toEqual([]);
    // Username matches come before name matches
    expect(names(await search(owner, id, "pmx"))).toEqual([one.username, byName.username]);
    expect(names(await search(owner, id, "PMXK"))).toEqual([byName.username]);
    expect(names(await search(owner, id, "@pmxo"))).toEqual([one.username]);
    // Not from the middle of a word
    expect(await search(owner, id, "mxk")).toEqual([]);
    // Never yourself
    expect(await search(owner, id, "srcha")).toEqual([]);
  });

  it("returns only public identity and shows who is already in the group", async () => {
    const owner = await createUser("srchb");
    const id = await newGroup(owner);
    const invited = await createUser("idqinv");
    await createUser("idqout");
    await api().post(`/api/shared/groups/${id}/members`).set("Authorization", owner.auth).send({ username: invited.username }).expect(201);

    const people = await search(owner, id, "idq");
    expect(people).toEqual([
      { username: invited.username, displayName: null, avatarUrl: null, inGroup: "invited" },
      { username: expect.stringMatching(/^idqout/), displayName: null, avatarUrl: null, inGroup: null },
    ]);
  });

  it("puts people you know first, then an exact username, and shows at most five", async () => {
    const owner = await createUser("srchc");
    const id = await newGroup(owner);
    for (let i = 0; i < 5; i++) await createUser(`rnka${i}`);
    const known = await createUser("rnkz");
    await api().post(`/api/follows/${known.username}`).set("Authorization", owner.auth).expect(200);

    const people = names(await search(owner, id, "rnk"));
    expect(people).toHaveLength(5);
    expect(people[0]).toBe(known.username);

    const exact = await createUser("xctq");
    await prisma.user.update({ where: { username: exact.username }, data: { username: "xctqexact" } });
    const named = await createUser("aaxct");
    await prisma.user.update({ where: { username: named.username }, data: { displayName: "Xctqexact Fan" } });
    expect(names(await search(owner, id, "xctqexact"))).toEqual(["xctqexact", named.username]);
  });

  it("is only for members of the group", async () => {
    const owner = await createUser("srchd");
    const outsider = await createUser("srche");
    const id = await newGroup(owner);
    await api().get(`/api/shared/groups/${id}/people`).query({ q: "srch" }).set("Authorization", outsider.auth).expect(404);
  });
});

describe("the search page", () => {
  type Found = { username: string; displayName: string | null; avatarUrl: string | null; following: string | null; followsYou: boolean };
  const find = async (user: User, q: string) =>
    (await api().get("/api/search/people").query({ q }).set("Authorization", user.auth).expect(200)).body.people as Found[];
  const follow = (from: User, to: User) => api().post(`/api/follows/${to.username}`).set("Authorization", from.auth).expect(200);

  it("finds people by username or name from two letters, and says how you're connected", async () => {
    const me = await createUser("pgme");
    const friend = await createUser("pgfriend");
    const fan = await createUser("pgfan");
    const shy = await createUser("pgshy");
    await prisma.user.update({ where: { email: friend.email }, data: { displayName: "Zubin Mehta" } });
    await api().put("/api/account/privacy").set("Authorization", shy.auth).send({ isPrivate: true }).expect(200);

    await follow(me, friend);
    await follow(fan, me);
    await follow(me, shy); // a request, since the profile is private

    expect(await find(me, "p")).toEqual([]);
    const people = await find(me, "pg");
    expect(people.map((p) => p.username)).not.toContain(me.username);
    const byName = Object.fromEntries(people.map((p) => [p.username, p]));
    expect(byName[friend.username]).toMatchObject({ displayName: "Zubin Mehta", following: "accepted", followsYou: false });
    expect(byName[fan.username]).toMatchObject({ following: null, followsYou: true });
    expect(byName[shy.username]).toMatchObject({ following: "pending", followsYou: false });

    // A later word of the name matches too, and "@" is ignored
    expect((await find(me, "meh")).map((p) => p.username)).toEqual([friend.username]);
    expect((await find(me, `@${shy.username}`)).map((p) => p.username)).toEqual([shy.username]);
    // Identity only
    expect(Object.keys(people[0]!).sort()).toEqual(["avatarUrl", "displayName", "following", "followsYou", "username"]);
  });

  it("shows up to 20 people, and needs a login", async () => {
    for (let i = 0; i < 22; i++) await createUser("manyq");
    const me = await createUser("manyme");
    expect(await find(me, "manyq")).toHaveLength(20);
    await api().get("/api/search/people").query({ q: "manyq" }).expect(401);
  });
});

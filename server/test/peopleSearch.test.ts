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

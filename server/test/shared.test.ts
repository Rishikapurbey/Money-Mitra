import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import prisma from "../src/db/prisma";

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const createGroup = async (user: User, name = "Goa trip") =>
  (await api().post("/api/shared/groups").set("Authorization", user.auth).send({ name }).expect(201)).body.group.id as string;
const groupOf = (user: User, id: string) => api().get(`/api/shared/groups/${id}`).set("Authorization", user.auth);
const listOf = async (user: User) => (await api().get("/api/shared/groups").set("Authorization", user.auth).expect(200)).body;
const addMember = (user: User, groupId: string, body: { username?: string; name?: string }) =>
  api().post(`/api/shared/groups/${groupId}/members`).set("Authorization", user.auth).send(body);
const inbox = async (user: User) => (await api().get("/api/notifications").set("Authorization", user.auth).expect(200)).body.notifications;

// Invites someone and has them accept; returns their member id
async function join(owner: User, groupId: string, friend: User) {
  const { member } = (await addMember(owner, groupId, { username: friend.username }).expect(201)).body;
  await api().post(`/api/shared/invites/${member.id}/accept`).set("Authorization", friend.auth).expect(200);
  return member.id as string;
}

describe("groups", () => {
  it("creates a group with its creator in it, and lets members rename and archive it", async () => {
    const asha = await createUser("asha");
    const id = await createGroup(asha);

    const { group } = (await groupOf(asha, id).expect(200)).body;
    expect(group).toMatchObject({ name: "Goa trip", archived: false });
    expect(group.members).toEqual([expect.objectContaining({ status: "active", name: asha.username, isMe: true, person: expect.objectContaining({ username: asha.username }) })]);

    await api().put(`/api/shared/groups/${id}`).set("Authorization", asha.auth).send({ name: "Goa 2026" }).expect(200);
    await api().put(`/api/shared/groups/${id}/archive`).set("Authorization", asha.auth).send({ archived: true }).expect(200);
    expect((await listOf(asha)).groups).toEqual([expect.objectContaining({ id, name: "Goa 2026", archived: true })]);
  });

  it("checks names", async () => {
    const user = await createUser("names");
    await api().post("/api/shared/groups").set("Authorization", user.auth).send({ name: "  " }).expect(400);
    await api().post("/api/shared/groups").set("Authorization", user.auth).send({ name: "x".repeat(41) }).expect(400);
    await api().post("/api/shared/groups").send({ name: "Flat" }).expect(401);
  });

  it("is hidden from everyone who isn't a member, including people only invited", async () => {
    const owner = await createUser("owner");
    const stranger = await createUser("stranger");
    const id = await createGroup(owner);
    await groupOf(stranger, id).expect(404);
    await api().put(`/api/shared/groups/${id}`).set("Authorization", stranger.auth).send({ name: "Mine now" }).expect(404);
    await addMember(stranger, id, { name: "Ravi" }).expect(404);

    await addMember(owner, id, { username: stranger.username }).expect(201);
    await groupOf(stranger, id).expect(404);
    expect((await listOf(stranger)).groups).toEqual([]);
  });
});

describe("inviting people on Money Mitra", () => {
  it("sends an invite they can accept, with a bell notice that goes once answered", async () => {
    const owner = await createUser("host");
    const friend = await createUser("guest");
    const id = await createGroup(owner, "Flat 4B");

    const { member } = (await addMember(owner, id, { username: `@${friend.username}` }).expect(201)).body;
    expect(member).toMatchObject({ status: "invited", name: friend.username });

    const [notice] = await inbox(friend);
    expect(notice).toMatchObject({ kind: "group_invite", title: "", actor: { username: owner.username } });
    expect(notice.message).toBe(`${owner.username} invited you to the shared group "Flat 4B"`);
    expect((await listOf(friend)).invites).toEqual([
      expect.objectContaining({ id: member.id, groupName: "Flat 4B", memberCount: 1, invitedBy: expect.objectContaining({ username: owner.username }) }),
    ]);

    expect((await api().post(`/api/shared/invites/${member.id}/accept`).set("Authorization", friend.auth).expect(200)).body).toEqual({ groupId: id });
    expect(await inbox(friend)).toEqual([]);
    expect((await groupOf(friend, id).expect(200)).body.group.members).toHaveLength(2);
    // An answered invite can't be answered again
    await api().post(`/api/shared/invites/${member.id}/accept`).set("Authorization", friend.auth).expect(404);
  });

  it("can be declined, or cancelled by a member", async () => {
    const owner = await createUser("host2");
    const friend = await createUser("guest2");
    const id = await createGroup(owner);

    const first = (await addMember(owner, id, { username: friend.username }).expect(201)).body.member;
    // Only the invited person can answer
    await api().delete(`/api/shared/invites/${first.id}`).set("Authorization", owner.auth).expect(404);
    await api().delete(`/api/shared/invites/${first.id}`).set("Authorization", friend.auth).expect(200);
    expect((await groupOf(owner, id)).body.group.members).toHaveLength(1);

    const second = (await addMember(owner, id, { username: friend.username }).expect(201)).body.member;
    await api().delete(`/api/shared/groups/${id}/members/${second.id}`).set("Authorization", owner.auth).expect(200);
    expect((await listOf(friend)).invites).toEqual([]);
    expect(await inbox(friend)).toEqual([]);
  });

  it("won't invite twice, yourself, or unknown people", async () => {
    const owner = await createUser("host3");
    const friend = await createUser("guest3");
    const id = await createGroup(owner);
    await addMember(owner, id, { username: owner.username }).expect(400);
    await addMember(owner, id, { username: "no_such_person" }).expect(404);
    await addMember(owner, id, { username: friend.username }).expect(201);
    await addMember(owner, id, { username: friend.username }).expect(400);
  });

  it("never shows members anything from each other's Tracker", async () => {
    const owner = await createUser("private");
    const friend = await createUser("friend");
    await api().post("/api/transactions").set("Authorization", owner.auth).send({ amount: 5000, type: "expense", category: "Food" }).expect(201);
    const id = await createGroup(owner);
    await join(owner, id, friend);

    const body = JSON.stringify((await groupOf(friend, id).expect(200)).body);
    expect(body).not.toContain("5000");
    expect(body).not.toContain(owner.email);
  });
});

describe("friends who aren't on Money Mitra", () => {
  it("adds them by name, without duplicates, and removes them", async () => {
    const owner = await createUser("namer");
    const id = await createGroup(owner);
    const { member } = (await addMember(owner, id, { name: "Ravi" }).expect(201)).body;
    expect(member).toMatchObject({ status: "active", name: "Ravi", person: null, isMe: false, linkShared: false });
    await addMember(owner, id, { name: "ravi" }).expect(400);
    await addMember(owner, id, { name: "" }).expect(400);

    await api().delete(`/api/shared/groups/${id}/members/${member.id}`).set("Authorization", owner.auth).expect(200);
    expect((await groupOf(owner, id)).body.group.members).toHaveLength(1);
  });

  it("gives a link that lets the friend take over their spot once", async () => {
    const owner = await createUser("linker");
    const ravi = await createUser("ravi");
    const someoneElse = await createUser("late");
    const id = await createGroup(owner, "Trek");
    const spot = (await addMember(owner, id, { name: "Ravi" }).expect(201)).body.member;

    const linkRes = await api().post(`/api/shared/groups/${id}/members/${spot.id}/link`).set("Authorization", owner.auth).expect(200);
    const token = linkRes.body.token as string;
    // Asking again gives the same link
    expect((await api().post(`/api/shared/groups/${id}/members/${spot.id}/link`).set("Authorization", owner.auth)).body.token).toBe(token);

    expect((await api().get(`/api/shared/join/${token}`).set("Authorization", ravi.auth).expect(200)).body).toEqual({
      groupId: id,
      groupName: "Trek",
      spotName: "Ravi",
      memberCount: 2,
      alreadyMember: false,
    });
    await api().post(`/api/shared/join/${token}`).set("Authorization", ravi.auth).expect(200);

    const members = (await groupOf(ravi, id).expect(200)).body.group.members;
    expect(members.find((m: { id: string }) => m.id === spot.id)).toMatchObject({ isMe: true, person: expect.objectContaining({ username: ravi.username }) });
    // Used links stop working
    await api().get(`/api/shared/join/${token}`).set("Authorization", someoneElse.auth).expect(404);
    await api().post(`/api/shared/join/${token}`).set("Authorization", someoneElse.auth).expect(404);
  });

  it("won't let a member take a second spot, and replaces a pending invite", async () => {
    const owner = await createUser("linker2");
    const friend = await createUser("friend2");
    const id = await createGroup(owner);
    const spotA = (await addMember(owner, id, { name: "Spot A" }).expect(201)).body.member;
    const spotB = (await addMember(owner, id, { name: "Spot B" }).expect(201)).body.member;
    const linkA = (await api().post(`/api/shared/groups/${id}/members/${spotA.id}/link`).set("Authorization", owner.auth)).body.token;
    const linkB = (await api().post(`/api/shared/groups/${id}/members/${spotB.id}/link`).set("Authorization", owner.auth)).body.token;

    expect((await api().get(`/api/shared/join/${linkA}`).set("Authorization", owner.auth)).body.alreadyMember).toBe(true);
    await api().post(`/api/shared/join/${linkA}`).set("Authorization", owner.auth).expect(400);

    await addMember(owner, id, { username: friend.username }).expect(201);
    await api().post(`/api/shared/join/${linkA}`).set("Authorization", friend.auth).expect(200);
    await api().post(`/api/shared/join/${linkB}`).set("Authorization", friend.auth).expect(400);
    const members = (await groupOf(friend, id)).body.group.members;
    expect(members.filter((m: { isMe: boolean }) => m.isMe)).toHaveLength(1);
    expect((await listOf(friend)).invites).toEqual([]);
  });

  it("only gives links for name-only members", async () => {
    const owner = await createUser("linker3");
    const friend = await createUser("friend3");
    const id = await createGroup(owner);
    const friendId = await join(owner, id, friend);
    await api().post(`/api/shared/groups/${id}/members/${friendId}/link`).set("Authorization", owner.auth).expect(400);
    // And people who joined can't be removed by others
    await api().delete(`/api/shared/groups/${id}/members/${friendId}`).set("Authorization", owner.auth).expect(400);
  });
});

describe("leaving", () => {
  it("removes the group from the person's list, and deletes it when no one is left", async () => {
    const owner = await createUser("leaver");
    const friend = await createUser("stayer");
    const id = await createGroup(owner);
    await addMember(owner, id, { name: "Ravi" }).expect(201);
    await join(owner, id, friend);

    await api().post(`/api/shared/groups/${id}/leave`).set("Authorization", owner.auth).expect(200);
    expect((await listOf(owner)).groups).toEqual([]);
    await groupOf(owner, id).expect(404);
    expect((await groupOf(friend, id).expect(200)).body.group.members.map((m: { name: string }) => m.name)).toEqual(["Ravi", friend.username]);

    // Invited back, they get their old spot
    const back = (await addMember(friend, id, { username: owner.username }).expect(201)).body.member;
    await api().post(`/api/shared/invites/${back.id}/accept`).set("Authorization", owner.auth).expect(200);
    await api().post(`/api/shared/groups/${id}/leave`).set("Authorization", owner.auth).expect(200);

    await api().post(`/api/shared/groups/${id}/leave`).set("Authorization", friend.auth).expect(200);
    expect(await prisma.sharedGroup.findUnique({ where: { id } })).toBeNull();
  });
});

describe("deleting an account", () => {
  it("keeps the person in shared groups as a name, and deletes groups only they could open", async () => {
    const leaving = await createUser("goner");
    const friend = await createUser("remains");
    await api().put("/api/account/profile").set("Authorization", leaving.auth).send({ displayName: "Meera", bio: "" }).expect(200);
    const shared = await createGroup(leaving, "Shared");
    const solo = await createGroup(leaving, "Solo");
    await addMember(leaving, solo, { name: "Ravi" }).expect(201);
    await join(leaving, shared, friend);
    // A pending invite of theirs simply goes
    const other = await createGroup(friend, "Other");
    await addMember(friend, other, { username: leaving.username }).expect(201);

    await api().delete("/api/account").set("Authorization", leaving.auth).send({ password: leaving.password }).expect(200);

    const members = (await groupOf(friend, shared).expect(200)).body.group.members;
    expect(members[0]).toMatchObject({ name: "Meera", person: null, isMe: false });
    expect(await prisma.sharedGroup.findUnique({ where: { id: solo } })).toBeNull();
    expect((await groupOf(friend, other)).body.group.members).toHaveLength(1);
  });
});

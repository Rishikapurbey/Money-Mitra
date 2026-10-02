import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import { sendEmail } from "../src/lib/email";
import prisma from "../src/db/prisma";

// Capture verification emails instead of sending them
vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

beforeAll(resetDatabase);

const lastToken = () => {
  const calls = vi.mocked(sendEmail).mock.calls;
  const text = calls[calls.length - 1][0].text;
  return /verify-email\?token=([A-Za-z0-9_-]+)/.exec(text)![1];
};
const me = async (auth: string) => (await api().get("/api/auth/me").set("Authorization", auth).expect(200)).body.user;

describe("email verification", () => {
  it("sends a link at signup and confirms the email once opened", async () => {
    vi.mocked(sendEmail).mockClear();
    const user = await createUser("verify", { verified: false });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe(user.email);
    expect((await me(user.auth)).emailVerified).toBe(false);

    const token = lastToken();
    await api().post("/api/auth/verify-email").send({ token }).expect(200);
    expect((await me(user.auth)).emailVerified).toBe(true);
    // Opening the same link again still shows success
    await api().post("/api/auth/verify-email").send({ token }).expect(200);
  });

  it("rejects unknown and expired links", async () => {
    await api().post("/api/auth/verify-email").send({ token: "not-a-real-token" }).expect(400);
    await api().post("/api/auth/verify-email").send({}).expect(400);

    const user = await createUser("expired", { verified: false });
    const token = lastToken();
    await prisma.emailVerification.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await api().post("/api/auth/verify-email").send({ token }).expect(400);
    expect((await me(user.auth)).emailVerified).toBe(false);
  });

  it("resends a new link, and the new link works", async () => {
    const user = await createUser("resend", { verified: false });
    vi.mocked(sendEmail).mockClear();
    await api().post("/api/auth/resend-verification").expect(401);
    await api().post("/api/auth/resend-verification").set("Authorization", user.auth).expect(200);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
    await api().post("/api/auth/verify-email").send({ token: lastToken() }).expect(200);
    expect((await me(user.auth)).emailVerified).toBe(true);

    // Nothing more is sent once confirmed
    await api().post("/api/auth/resend-verification").set("Authorization", user.auth).expect(200);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
  });

  it("needs a confirmed email to post or reply in Discuss, but not to use the tracker", async () => {
    const user = await createUser("unconfirmed", { verified: false });
    const confirmed = await createUser("confirmed");

    const ask = await api().post("/api/posts").set("Authorization", user.auth).send({ title: "Is an SIP better than an FD?", topic: "Investing" });
    expect(ask.status).toBe(403);
    expect(ask.body.error).toMatch(/confirm your email/);

    const post = await api().post("/api/posts").set("Authorization", confirmed.auth).send({ title: "Is an SIP better than an FD?", topic: "Investing" }).expect(201);
    await api().post(`/api/posts/${post.body.post.id}/replies`).set("Authorization", user.auth).send({ body: "Depends" }).expect(403);
    await api().get("/api/posts").set("Authorization", user.auth).expect(200);
    await api().get("/api/transactions").set("Authorization", user.auth).expect(200);
  });

  it("does not email replies to an unconfirmed address", async () => {
    const asker = await createUser("asker");
    const other = await createUser("other");
    const res = await api().post("/api/posts").set("Authorization", asker.auth).send({ title: "Where do I start investing?", topic: "Investing" }).expect(201);
    await prisma.user.update({ where: { email: asker.email }, data: { emailVerifiedAt: null } });
    vi.mocked(sendEmail).mockClear();
    await api().post(`/api/posts/${res.body.post.id}/replies`).set("Authorization", other.auth).send({ body: "Start with an index fund" }).expect(201);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });
});

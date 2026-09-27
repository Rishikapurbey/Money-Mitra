import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import { sendEmail } from "../src/lib/email";

// Capture reset emails instead of sending them
vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

beforeAll(resetDatabase);

const lastResetToken = () => {
  const calls = vi.mocked(sendEmail).mock.calls;
  const text = calls[calls.length - 1][0].text;
  return /token=([A-Za-z0-9_-]+)/.exec(text)![1];
};

describe("password reset", () => {
  it("answers the same way whether or not the account exists", async () => {
    vi.mocked(sendEmail).mockClear();
    const user = await createUser("reset");
    const known = await api().post("/api/auth/forgot-password").send({ email: user.email });
    const unknown = await api().post("/api/auth/forgot-password").send({ email: "nobody@example.com" });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
  });

  it("resets once, ends old sessions, and rejects reuse", async () => {
    const user = await createUser("reset");
    await api().post("/api/auth/forgot-password").send({ email: user.email }).expect(200);
    const token = lastResetToken();

    await api().post("/api/auth/reset-password").send({ token, password: "Brandnew123" }).expect(200);
    await api().post("/api/auth/reset-password").send({ token, password: "Another123" }).expect(400);
    await api().get("/api/auth/me").set("Authorization", user.auth).expect(401);
    await api().post("/api/auth/login").send({ email: user.email, password: user.password }).expect(401);
    await api().post("/api/auth/login").send({ email: user.email, password: "Brandnew123" }).expect(200);
  });
});

describe("account settings", () => {
  it("changing the password logs out other sessions but keeps this one", async () => {
    const user = await createUser("change");
    const res = await api()
      .put("/api/account/password")
      .set("Authorization", user.auth)
      .send({ currentPassword: user.password, newPassword: "Changed123" })
      .expect(200);
    await api().get("/api/auth/me").set("Authorization", user.auth).expect(401);
    await api().get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`).expect(200);
  });

  it("a wrong current password is a 400, so the app doesn't log the user out", async () => {
    const user = await createUser("wrong");
    await api()
      .put("/api/account/password")
      .set("Authorization", user.auth)
      .send({ currentPassword: "NotMine123", newPassword: "Changed123" })
      .expect(400);
  });

  it("export never includes the password hash", async () => {
    const user = await createUser("export");
    const res = await api().get("/api/account/export").set("Authorization", user.auth).expect(200);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("deleting an account keeps its Discuss posts as Deleted user", async () => {
    const leaving = await createUser("leaving");
    const reader = await createUser("reader");
    const post = await api().post("/api/posts").set("Authorization", leaving.auth).send({ title: "Question before I leave", topic: "Other" }).expect(201);

    await api().delete("/api/account").set("Authorization", leaving.auth).send({ password: leaving.password }).expect(200);
    await api().post("/api/auth/login").send({ email: leaving.email, password: leaving.password }).expect(401);
    const seen = (await api().get(`/api/posts/${post.body.post.id}`).set("Authorization", reader.auth)).body.post;
    expect(seen.author).toBe("Deleted user");
  });
});

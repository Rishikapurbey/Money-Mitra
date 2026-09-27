import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

describe("auth", () => {
  it("rejects weak signups with a clear message", async () => {
    const res = await api().post("/api/auth/signup").send({ email: "x@example.com", username: "weak_one", password: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Password/);
  });

  it("treats emails as case-insensitive for login and duplicates", async () => {
    const user = await createUser("case");
    await api().post("/api/auth/login").send({ email: user.email.toUpperCase(), password: user.password }).expect(200);
    const dup = await api().post("/api/auth/signup").send({ email: user.email.toUpperCase(), username: "another_one", password: "Password123" });
    expect(dup.status).toBe(409);
  });

  it("does not reveal whether an email exists on login", async () => {
    const user = await createUser("login");
    const wrongPassword = await api().post("/api/auth/login").send({ email: user.email, password: "Wrong12345" });
    const noAccount = await api().post("/api/auth/login").send({ email: "nobody@example.com", password: "Wrong12345" });
    expect(wrongPassword.status).toBe(401);
    expect(noAccount.body).toEqual(wrongPassword.body);
  });

  it("requires a token for private routes", async () => {
    await api().get("/api/transactions").expect(401);
  });

  it("answers unknown routes with JSON, not a stack trace", async () => {
    const res = await api().get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

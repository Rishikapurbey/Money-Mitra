import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

describe("log out of all other devices", () => {
  it("ends every existing login but keeps this device signed in with a new token", async () => {
    const user = await createUser("everywhere");
    const otherDevice = (await api().post("/api/auth/login").send({ email: user.email, password: user.password }).expect(200)).body.token;

    const res = await api().post("/api/account/logout-everywhere").set("Authorization", user.auth).expect(200);
    const fresh = `Bearer ${res.body.token}`;

    await api().get("/api/auth/me").set("Authorization", user.auth).expect(401);
    await api().get("/api/auth/me").set("Authorization", `Bearer ${otherDevice}`).expect(401);
    await api().get("/api/auth/me").set("Authorization", fresh).expect(200);
  });
});

describe("feedback", () => {
  it("emails the message with the sender's details, safely escaped", async () => {
    const user = await createUser("feedback");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await api()
      .post("/api/feedback")
      .set("Authorization", user.auth)
      .send({ kind: "idea", message: "Please add <b>dark</b> charts for budgets" })
      .expect(200);
    // Without Brevo configured (as in tests), the email is printed instead of sent
    const printed = log.mock.calls.map((c) => String(c[0])).join("\n");
    log.mockRestore();
    expect(printed).toContain(`[Feedback: Idea] from ${user.username}`);
    expect(printed).toContain(user.email);
    expect(printed).toContain("Please add <b>dark</b> charts for budgets");
  });

  it("rejects missing or unusual input", async () => {
    const user = await createUser("badfeedback");
    const send = (body: Record<string, unknown>) => api().post("/api/feedback").set("Authorization", user.auth).send(body);
    await send({ kind: "idea", message: "too short" }).expect(400);
    await send({ kind: "complaint", message: "A perfectly long message here" }).expect(400);
    await send({ kind: "idea", message: "x".repeat(2001) }).expect(400);
    await api().post("/api/feedback").send({ kind: "idea", message: "Not logged in at all" }).expect(401);
  });
});

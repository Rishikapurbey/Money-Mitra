import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createUser, resetDatabase } from "./helpers";
import { sendEmail } from "../src/lib/email";
import prisma from "../src/db/prisma";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

beforeAll(resetDatabase);

type User = Awaited<ReturnType<typeof createUser>>;

const row = (overrides: Record<string, unknown> = {}) => ({
  date: "2026-03-05T12:00:00Z",
  amount: 250,
  type: "expense",
  category: "Food",
  note: "Swiggy",
  ...overrides,
});

const importRows = (user: User, rows: unknown, fileName = "statement.csv") =>
  api().post("/api/imports").set("Authorization", user.auth).send({ fileName, rows, tzOffset: -330 });

const transactions = async (user: User) =>
  (await api().get("/api/transactions").set("Authorization", user.auth).expect(200)).body.transactions as {
    id: string;
    category: string;
    note: string;
  }[];

const imports = async (user: User) =>
  (await api().get("/api/imports").set("Authorization", user.auth).expect(200)).body.imports as {
    id: string;
    fileName: string;
    count: number;
    remaining: number;
  }[];

describe("importing transactions", () => {
  it("adds every row, joins new categories to the list and keeps existing spellings", async () => {
    const user = await createUser("import");
    const res = await importRows(user, [
      row(),
      row({ category: "food", note: "Zomato" }),
      row({ amount: 50000, type: "income", category: "Salary", note: null }),
      row({ category: "Groceries", note: "Blinkit" }),
    ]).expect(201);
    expect(res.body.import.count).toBe(4);

    const saved = await transactions(user);
    expect(saved.map((t) => t.category).sort()).toEqual(["Food", "Food", "Groceries", "Salary"]);
    const categories = (await api().get("/api/categories").set("Authorization", user.auth).expect(200)).body.categories;
    expect(categories.filter((c: { name: string }) => c.name.toLowerCase() === "groceries")).toHaveLength(1);

    expect(await imports(user)).toEqual([expect.objectContaining({ fileName: "statement.csv", count: 4, remaining: 4 })]);
  });

  it("saves nothing when any row is invalid, and says which row", async () => {
    const user = await createUser("invalid");
    const bad = await importRows(user, [row(), row({ amount: -5 })]).expect(400);
    expect(bad.body.error).toBe("Row 2: Amount must be a positive number");
    const badDate = await importRows(user, [row({ date: "not a date" })]).expect(400);
    expect(badDate.body.error).toBe("Row 1: Date is missing or not valid");
    await importRows(user, [row({ date: "2099-01-01T12:00:00Z" })]).expect(400);
    await importRows(user, []).expect(400);
    expect(await transactions(user)).toHaveLength(0);
    expect(await imports(user)).toHaveLength(0);
  });

  it("limits the number of rows, and accepts the largest allowed file", async () => {
    const user = await createUser("big");
    const many = Array.from({ length: 2000 }, (_, i) => row({ amount: i + 1, note: `UPI/${100000 + i}/Some merchant name` }));
    expect((await importRows(user, many).expect(201)).body.import.count).toBe(2000);
    const tooMany = await importRows(user, [...many, row()]).expect(400);
    expect(tooMany.body.error).toBe("You can import up to 2000 transactions at a time");
  });

  it("undoes a whole import, including edited entries, without touching anything else", async () => {
    const user = await createUser("undo");
    await api().post("/api/transactions").set("Authorization", user.auth).send(row({ note: "Added by hand" })).expect(201);
    const { id } = (await importRows(user, [row(), row({ note: "Second" })]).expect(201)).body.import;

    const imported = (await transactions(user)).find((t) => t.note === "Second")!;
    await api().put(`/api/transactions/${imported.id}`).set("Authorization", user.auth).send(row({ note: "Edited" })).expect(200);

    const res = await api().delete(`/api/imports/${id}`).set("Authorization", user.auth).expect(200);
    expect(res.body.removed).toBe(2);
    expect((await transactions(user)).map((t) => t.note)).toEqual(["Added by hand"]);
    expect(await imports(user)).toHaveLength(0);
  });

  it("shows how many entries are left after some are deleted by hand", async () => {
    const user = await createUser("remaining");
    await importRows(user, [row(), row({ note: "Delete me" })]).expect(201);
    const target = (await transactions(user)).find((t) => t.note === "Delete me")!;
    await api().delete(`/api/transactions/${target.id}`).set("Authorization", user.auth).expect(200);
    expect(await imports(user)).toEqual([expect.objectContaining({ count: 2, remaining: 1 })]);
  });

  it("keeps imports private to their owner", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const { id } = (await importRows(owner, [row()]).expect(201)).body.import;
    expect(await imports(other)).toHaveLength(0);
    await api().delete(`/api/imports/${id}`).set("Authorization", other.auth).expect(404);
    expect(await transactions(owner)).toHaveLength(1);
  });

  it("alerts about budgets in the app only, never by email", async () => {
    const user = await createUser("budget");
    await prisma.user.update({ where: { email: user.email }, data: { emailBudgetAlerts: true } });
    await api().put("/api/budgets").set("Authorization", user.auth).send({ category: "Food", amount: 1000 }).expect(200);
    vi.mocked(sendEmail).mockClear();

    const now = new Date().toISOString();
    const res = await importRows(user, [
      row({ date: now, amount: 700 }),
      row({ date: now, amount: 600, category: "food" }),
      row({ amount: 99999 }),
    ]).expect(201);
    expect(res.body.budgetAlert).toMatchObject({ level: 100 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("is removed along with the account", async () => {
    const user = await createUser("deleted");
    await importRows(user, [row()]).expect(201);
    const { id: userId } = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    expect(await prisma.import.count({ where: { userId } })).toBe(1);
    await api().delete("/api/account").set("Authorization", user.auth).send({ password: user.password }).expect(200);
    expect(await prisma.import.count({ where: { userId } })).toBe(0);
  });
});

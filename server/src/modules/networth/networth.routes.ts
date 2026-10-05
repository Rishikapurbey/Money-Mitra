import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { parseTzOffset } from "../transactions/transaction.input";
import { ITEM_TYPES } from "./networth";
import type { ItemKind } from "./networth";
import { createItem, getNetWorth, itemHistory, netWorthSummary, recordValue, removeItem, setMain, updateItem } from "./networth.service";

const router = Router();

const MAX_VALUE = 100_000_000_000;

// Returns the value, or an error message
function parseValue(raw: unknown): number | string {
  const value = Number(raw);
  if (raw === "" || raw === null || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
    return "Value must be zero or more";
  }
  return Math.round(value * 100) / 100;
}

function parseNameAndType(body: Record<string, unknown>, kind: ItemKind): { name: string; type: string } | string {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  if (!name || name.length > 60) return "Name is required (up to 60 characters)";
  if (!(type in ITEM_TYPES[kind])) return "Choose a type";
  return { name, type };
}

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await getNetWorth(req.userId, parseTzOffset(req.query.tzOffset)));
});

// The Home card; also sends the monthly reminder when values are out of date
router.get("/summary", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await netWorthSummary(req.userId, parseTzOffset(req.query.tzOffset)));
});

router.post("/items", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const kind = req.body.kind;
  if (kind !== "asset" && kind !== "liability") return res.status(400).json({ error: "Choose something you own or owe" });
  const fields = parseNameAndType(req.body, kind);
  if (typeof fields === "string") return res.status(400).json({ error: fields });
  const value = parseValue(req.body.value);
  if (typeof value === "string") return res.status(400).json({ error: value });
  res.status(201).json({ item: await createItem(req.userId, { ...fields, kind, value }) });
});

router.put("/items/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const kind = req.body.kind;
  if (kind !== "asset" && kind !== "liability") return res.status(400).json({ error: "Choose something you own or owe" });
  const fields = parseNameAndType(req.body, kind);
  if (typeof fields === "string") return res.status(400).json({ error: fields });
  res.status(200).json({ item: await updateItem(req.userId, req.params.id as string, fields) });
});

router.put("/items/:id/main", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  if (typeof req.body.isMain !== "boolean") return res.status(400).json({ error: "Invalid request" });
  await setMain(req.userId, req.params.id as string, req.body.isMain);
  res.status(200).json({ success: true });
});

router.post("/items/:id/values", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const value = parseValue(req.body.value);
  if (typeof value === "string") return res.status(400).json({ error: value });
  res.status(200).json({ item: await recordValue(req.userId, req.params.id as string, value) });
});

router.get("/items/:id/values", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ values: await itemHistory(req.userId, req.params.id as string) });
});

router.delete("/items/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await removeItem(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

export default router;

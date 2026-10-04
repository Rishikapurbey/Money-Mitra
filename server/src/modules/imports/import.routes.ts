import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { importLimiter } from "../../middleware/rateLimit";
import { parseDate, parseTransaction, parseTzOffset } from "../transactions/transaction.input";
import { ImportRow, MAX_IMPORT_ROWS, checkImportedBudgets, importTransactions, listImports, undoImport } from "./import.service";

const router = Router();

const DAY = 24 * 60 * 60 * 1000;
const EARLIEST = new Date("1990-01-01T00:00:00Z");

// Returns the validated rows, or an error message naming the first bad row
function parseRows(value: unknown): ImportRow[] | string {
  if (!Array.isArray(value) || value.length === 0) return "There are no transactions to import";
  if (value.length > MAX_IMPORT_ROWS) return `You can import up to ${MAX_IMPORT_ROWS} transactions at a time`;
  const rows: ImportRow[] = [];
  // A day's leeway, since "today" in the user's timezone can be tomorrow in UTC
  const latest = new Date(Date.now() + DAY);
  for (const [i, raw] of value.entries()) {
    const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const input = parseTransaction(body);
    if (typeof input === "string") return `Row ${i + 1}: ${input}`;
    const date = parseDate(body.date);
    if (!date || date < EARLIEST || date > latest) return `Row ${i + 1}: Date is missing or not valid`;
    rows.push({ ...input, date });
  }
  return rows;
}

router.post("/", authMiddleware, importLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const rows = parseRows(req.body.rows);
  if (typeof rows === "string") return res.status(400).json({ error: rows });
  const name = typeof req.body.fileName === "string" ? req.body.fileName.trim().slice(0, 100) : "";
  const created = await importTransactions(req.userId, name || "Imported file", rows);
  const budgetAlert = await checkImportedBudgets(req.userId, rows, parseTzOffset(req.body.tzOffset));
  res.status(201).json({ import: { id: created.id, count: created.count }, budgetAlert });
});

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ imports: await listImports(req.userId) });
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const removed = await undoImport(req.userId, String(req.params.id));
  res.status(200).json({ removed });
});

export default router;

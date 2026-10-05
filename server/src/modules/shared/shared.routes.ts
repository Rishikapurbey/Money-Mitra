import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { sharedLimiter } from "../../middleware/rateLimit";
import { text } from "../../lib/validation";
import { parseDate, parseTzOffset } from "../transactions/transaction.input";
import { addExpense, addSettlement, deleteExpense, deleteSettlement, updateExpense } from "./expense.service";
import type { ExpenseInput, SplitInput } from "./expense.service";
import { toPaise } from "./split";
import {
  acceptInvite,
  addNameOnly,
  createGroup,
  declineInvite,
  getGroup,
  inviteUser,
  joinByLink,
  joinPreview,
  leaveGroup,
  listGroups,
  removeMember,
  renameGroup,
  setArchived,
  shareLink,
  sharedSummary,
} from "./shared.service";

const router = Router();

const groupName = (raw: unknown) => {
  const name = text(raw);
  return name && name.length <= 40 ? name : null;
};
const GROUP_NAME_ERROR = "Group name is required (up to 40 characters)";

const MAX_RUPEES = 1_000_000_000;

// Rupees from the app to whole paise; null when it isn't a usable amount
function paise(raw: unknown, { allowZero = false } = {}) {
  const value = Number(raw);
  if (raw === "" || raw === null || typeof raw === "boolean" || !Number.isFinite(value) || value > MAX_RUPEES) return null;
  const amount = toPaise(value);
  return amount > 0 || (allowZero && amount === 0) ? amount : null;
}

const ids = (raw: unknown) => (Array.isArray(raw) && raw.length <= 100 && raw.every((x) => typeof x === "string") ? (raw as string[]) : null);

function parseSplit(raw: unknown): SplitInput | null {
  if (!raw || typeof raw !== "object") return null;
  const split = raw as Record<string, unknown>;
  if (split.type === "equal") {
    const memberIds = ids(split.memberIds);
    return memberIds ? { type: "equal", memberIds } : null;
  }
  if (split.type === "exact" && Array.isArray(split.shares) && split.shares.length <= 100) {
    const shares: { memberId: string; amount: number }[] = [];
    for (const item of split.shares as Record<string, unknown>[]) {
      const amount = paise(item?.amount, { allowZero: true });
      if (typeof item?.memberId !== "string" || amount === null) return null;
      shares.push({ memberId: item.memberId, amount });
    }
    return { type: "exact", shares };
  }
  return null;
}

// Returns the validated expense, or an error message
function parseExpense(body: Record<string, unknown>): ExpenseInput | string {
  const description = text(body.description);
  if (!description || description.length > 60) return "Describe the expense (up to 60 characters)";
  const amount = paise(body.amount);
  if (amount === null) return "Amount must be a positive number";
  const category = text(body.category);
  if (!category || category.length > 50) return "Category is required (up to 50 characters)";
  const date = parseDate(body.date);
  if (date === null) return "Invalid date";
  if (typeof body.paidById !== "string") return "Choose who paid";
  const split = parseSplit(body.split);
  if (!split) return "Choose how to split it";
  return { description, amount, category, date, paidById: body.paidById, split };
}

router.get("/groups", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await listGroups(req.userId));
});

router.get("/summary", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await sharedSummary(req.userId));
});

router.post("/groups", authMiddleware, sharedLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const name = groupName(req.body.name);
  if (!name) return res.status(400).json({ error: GROUP_NAME_ERROR });
  res.status(201).json({ group: await createGroup(req.userId, name) });
});

router.get("/groups/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ group: await getGroup(req.userId, req.params.id as string) });
});

router.put("/groups/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const name = groupName(req.body.name);
  if (!name) return res.status(400).json({ error: GROUP_NAME_ERROR });
  await renameGroup(req.userId, req.params.id as string, name);
  res.status(200).json({ success: true });
});

router.put("/groups/:id/archive", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  if (typeof req.body.archived !== "boolean") return res.status(400).json({ error: "Invalid request" });
  await setArchived(req.userId, req.params.id as string, req.body.archived);
  res.status(200).json({ success: true });
});

// Either { username } to invite someone on Money Mitra, or { name } for a friend who isn't
router.post("/groups/:id/members", authMiddleware, sharedLimiter, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = req.params.id as string;
  const username = text(req.body.username).replace(/^@/, "");
  if (username) return res.status(201).json({ member: await inviteUser(req.userId, groupId, username) });
  const name = text(req.body.name);
  if (!name || name.length > 40) return res.status(400).json({ error: "Enter a username, or a name (up to 40 characters)" });
  res.status(201).json({ member: await addNameOnly(req.userId, groupId, name) });
});

router.delete("/groups/:id/members/:memberId", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await removeMember(req.userId, req.params.id as string, req.params.memberId as string);
  res.status(200).json({ success: true });
});

router.post("/groups/:id/members/:memberId/link", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ token: await shareLink(req.userId, req.params.id as string, req.params.memberId as string) });
});

router.post("/groups/:id/leave", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await leaveGroup(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

router.post("/groups/:id/expenses", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseExpense(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  res.status(201).json(await addExpense(req.userId, req.params.id as string, input, parseTzOffset(req.body.tzOffset)));
});

router.put("/groups/:id/expenses/:expenseId", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const input = parseExpense(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });
  const { id, expenseId } = req.params as { id: string; expenseId: string };
  res.status(200).json(await updateExpense(req.userId, id, expenseId, input, parseTzOffset(req.body.tzOffset)));
});

router.delete("/groups/:id/expenses/:expenseId", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deleteExpense(req.userId, req.params.id as string, req.params.expenseId as string);
  res.status(200).json({ success: true });
});

// Someone paying someone back
router.post("/groups/:id/settlements", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const amount = paise(req.body.amount);
  if (amount === null) return res.status(400).json({ error: "Amount must be a positive number" });
  const date = parseDate(req.body.date);
  if (date === null) return res.status(400).json({ error: "Invalid date" });
  const { fromMemberId, toMemberId } = req.body;
  if (typeof fromMemberId !== "string" || typeof toMemberId !== "string") return res.status(400).json({ error: "Choose who paid whom" });
  const settlement = await addSettlement(req.userId, req.params.id as string, { fromMemberId, toMemberId, amount, date: date ?? new Date() });
  res.status(201).json(settlement);
});

router.delete("/groups/:id/settlements/:settlementId", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deleteSettlement(req.userId, req.params.id as string, req.params.settlementId as string);
  res.status(200).json({ success: true });
});

router.post("/invites/:id/accept", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await acceptInvite(req.userId, req.params.id as string));
});

router.delete("/invites/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await declineInvite(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

router.get("/join/:token", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await joinPreview(req.userId, req.params.token as string));
});

router.post("/join/:token", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json(await joinByLink(req.userId, req.params.token as string));
});

export default router;

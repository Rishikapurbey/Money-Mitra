import { Router } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { text } from "../../lib/validation";
import {
  CategoryType,
  createCategory,
  deleteCategory,
  listCategories,
  mergeCategory,
  renameCategory,
} from "./category.service";

const router = Router();

// Returns the trimmed name, or null if it isn't acceptable
function parseName(value: unknown): string | null {
  const name = text(value);
  return name && name.length <= 50 ? name : null;
}
const NAME_ERROR = "Category name is required (up to 50 characters)";

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).json({ categories: await listCategories(req.userId) });
});

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const name = parseName(req.body.name);
  if (!name) return res.status(400).json({ error: NAME_ERROR });
  const type = req.body.type;
  if (type !== "income" && type !== "expense") return res.status(400).json({ error: "Type must be income or expense" });
  const category = await createCategory(req.userId, name, type as CategoryType);
  res.status(201).json({ category });
});

router.patch("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const name = parseName(req.body.name);
  if (!name) return res.status(400).json({ error: NAME_ERROR });
  const category = await renameCategory(req.userId, req.params.id as string, name);
  res.status(200).json({ category });
});

router.post("/:id/merge", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const intoId = text(req.body.intoId);
  if (!intoId) return res.status(400).json({ error: "Choose a category to merge into" });
  const category = await mergeCategory(req.userId, req.params.id as string, intoId);
  res.status(200).json({ category });
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  await deleteCategory(req.userId, req.params.id as string);
  res.status(200).json({ success: true });
});

export default router;

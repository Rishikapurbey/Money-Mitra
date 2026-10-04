// Checks for transaction fields sent by the app, shared by adding one at a time and importing a file

// Returns undefined when absent, null when present but not a valid date
export function parseDate(value: unknown): Date | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
}

export interface TransactionInput {
  amount: number;
  type: string;
  category: string;
  note: string | null;
}

// Returns the validated fields, or an error message
export function parseTransaction(body: Record<string, unknown>): TransactionInput | string {
  const amount = Number(body.amount);
  const type = body.type;
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return "Amount must be a positive number";
  }
  if (type !== "income" && type !== "expense") return "Type must be income or expense";
  if (!category || category.length > 50) return "Category is required (up to 50 characters)";
  if (note.length > 200) return "Note can be up to 200 characters";
  return { amount, type, category, note: note || null };
}

// The client's Date.getTimezoneOffset(), so "this month" means the user's month; UTC if missing
export function parseTzOffset(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : 0;
}

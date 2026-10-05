export interface RecurringRule {
  id: string;
  // Empty for a bill whose amount varies
  amount: number | null;
  type: "income" | "expense";
  category: string;
  note: string | null;
  // auto: added on the day by itself | remind: a bill to mark paid (or skip) when due
  mode: "auto" | "remind";
  frequency: "monthly" | "yearly";
  dayOfMonth: number;
  // For yearly ones, the month (0-11)
  monthOfYear: number | null;
  // For a bill, the oldest due date not yet paid or skipped
  nextDue: string;
  endDate: string | null;
  paused: boolean;
}

// What a bill or recurring entry is called: its note, or else its category
export const ruleName = (rule: Pick<RecurringRule, "note" | "category">) => rule.note?.trim() || rule.category;

// "Every month on the 7th" or "Every year on 20 Mar"
export function scheduleLabel(rule: Pick<RecurringRule, "frequency" | "dayOfMonth" | "monthOfYear">) {
  if (rule.frequency === "yearly" && rule.monthOfYear !== null) {
    const month = new Date(2000, rule.monthOfYear, 1).toLocaleDateString("en-IN", { month: "short" });
    return `Every year on ${rule.dayOfMonth} ${month}`;
  }
  return `Every month on the ${ordinal(rule.dayOfMonth)}`;
}

// Whole days from today until a date: 0 today, negative once it has passed
export function daysUntil(iso: string, now = new Date()) {
  const due = new Date(iso);
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

// "Due today", "Due tomorrow", "Due in 5 days", "Overdue since 1 Oct"
export function dueLabel(iso: string, now = new Date()) {
  const days = daysUntil(iso, now);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  return `Overdue since ${new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

// Bills to show on Home: overdue, or due within the next week
export const billsDue = (rules: RecurringRule[], now = new Date()) =>
  rules
    .filter((r) => r.mode === "remind" && !r.paused && (!r.endDate || r.nextDue <= r.endDate) && daysUntil(r.nextDue, now) <= 7)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));

// 1 -> "1st", 22 -> "22nd", 31 -> "31st"
export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

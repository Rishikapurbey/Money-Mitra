export interface RecurringRule {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  note: string | null;
  dayOfMonth: number;
  nextDue: string;
  endDate: string | null;
  paused: boolean;
}

// 1 -> "1st", 22 -> "22nd", 31 -> "31st"
export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

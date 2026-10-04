// A look back at a whole year (or the year so far): totals, month by month, where the money went,
// budgets, goals and a few plain-English highlights. Pure: no database access.
import { byCategory, key, round2, rupees, totalsOf } from "./recap";
import type { RecapTransaction, Totals } from "./recap";

export interface YearMonth {
  // YYYY-MM, a short label for charts, and its bounds in the user's timezone
  month: string;
  label: string;
  name: string;
  from: Date;
  to: Date;
}

export interface YearInput {
  year: string;
  // Every month of the year that has started, in order
  months: YearMonth[];
  // True while the year is still running; the last month is then unfinished
  inProgress: boolean;
  now: Date;
  current: RecapTransaction[];
  previous: RecapTransaction[];
  budgets: { category: string; amount: number }[];
  // `added` is the net amount put into the goal during the year
  goals: { name: string; savedAmount: number; targetAmount: number; added: number }[];
}

export interface YearReview {
  year: string;
  inProgress: boolean;
  enoughData: boolean;
  transactionCount: number;
  totals: Totals;
  previous: Totals | null;
  months: { month: string; label: string; income: number; expense: number; saved: number }[];
  bestMonth: { month: string; name: string; saved: number } | null;
  toughestMonth: { month: string; name: string; saved: number } | null;
  categories: { name: string; amount: number; share: number; perMonth: number }[];
  budgets: { category: string; limit: number; monthsWithin: number; monthsCounted: number }[];
  goals: { name: string; savedAmount: number; targetAmount: number; pct: number; added: number }[];
  goalsAdded: number;
  biggestExpense: { amount: number; category: string; note: string | null; date: Date } | null;
  noSpendDays: number;
  daysCounted: number;
  // **double asterisks** mark text the app shows in bold
  highlights: string[];
}

export const MIN_YEAR_TRANSACTIONS = 10;
const MAX_CATEGORIES = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeYearReview(input: YearInput): YearReview {
  const { current, previous, months, inProgress, now } = input;
  const totals = totalsOf(current);
  const prev = previous.length > 0 ? totalsOf(previous) : null;
  const inMonth = (t: RecapTransaction, m: YearMonth) => t.date >= m.from && t.date < m.to;

  // Months from the first one with any entry, so a year joined in September isn't judged on January
  const firstActive = months.findIndex((m) => current.some((t) => inMonth(t, m)));
  const active = firstActive === -1 ? [] : months.slice(firstActive);
  const byMonth = active.map((m) => {
    const t = totalsOf(current.filter((tx) => inMonth(tx, m)));
    return { ...m, income: t.income, expense: t.expense, saved: t.saved };
  });
  // Best and toughest are judged on finished months only
  const finished = inProgress ? byMonth.slice(0, -1) : byMonth;
  const pick = (better: (a: number, b: number) => boolean) =>
    finished.reduce<(typeof byMonth)[number] | null>((top, m) => (!top || better(m.saved, top.saved) ? m : top), null);
  const best = finished.length >= 2 ? pick((a, b) => a > b) : null;
  const toughest = finished.length >= 2 ? pick((a, b) => a < b) : null;

  const monthCount = Math.max(1, active.length);
  const categories = [...byCategory(current).values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, MAX_CATEGORIES)
    .map((c) => ({
      name: c.name,
      amount: round2(c.amount),
      share: totals.expense > 0 ? Math.round((c.amount / totals.expense) * 100) : 0,
      perMonth: Math.round(c.amount / monthCount),
    }));

  // For each budget, how many finished months stayed within it
  const budgets = input.budgets
    .filter((b) => b.amount > 0)
    .map((b) => {
      const spentEach = finished.map((m) =>
        current
          .filter((t) => t.type === "expense" && key(t.category) === key(b.category) && inMonth(t, m))
          .reduce((sum, t) => sum + t.amount, 0)
      );
      return {
        category: b.category,
        limit: b.amount,
        monthsWithin: spentEach.filter((spent) => spent <= b.amount).length,
        monthsCounted: spentEach.length,
      };
    });

  const goals = input.goals.map((g) => ({
    name: g.name,
    savedAmount: g.savedAmount,
    targetAmount: g.targetAmount,
    pct: g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0,
    added: round2(g.added),
  }));
  const goalsAdded = round2(goals.reduce((sum, g) => sum + g.added, 0));

  const expenses = current.filter((t) => t.type === "expense");
  const biggest = expenses.reduce<RecapTransaction | null>((top, t) => (!top || t.amount > top.amount ? t : top), null);

  // Days without spending, from the first active month to today (or the end of the year)
  const start = active[0]?.from;
  const end = inProgress ? now : active[active.length - 1]?.to;
  const daysCounted = start && end ? Math.max(0, Math.ceil((end.getTime() - start.getTime()) / DAY_MS)) : 0;
  const spendDays = start ? new Set(expenses.map((t) => Math.floor((t.date.getTime() - start.getTime()) / DAY_MS))) : new Set();
  const noSpendDays = Math.max(0, daysCounted - spendDays.size);

  const highlights: string[] = [];
  const so = inProgress ? " so far" : "";
  if (totals.savingsRate !== null && totals.saved >= 0) {
    highlights.push(`You saved **${rupees(totals.saved)}**${so}, **${totals.savingsRate}%** of what you earned.`);
  } else if (totals.income > 0 && totals.saved < 0) {
    highlights.push(`You spent **${rupees(-totals.saved)} more** than you earned${so}.`);
  }
  if (best && best.saved > 0) highlights.push(`Your best month was **${best.name}**, when you saved ${rupees(best.saved)}.`);
  const top = categories[0];
  if (top) highlights.push(`**${top.name}** was your biggest expense: ${rupees(top.amount)}, about ${rupees(top.perMonth)} a month.`);
  if (goalsAdded > 0) highlights.push(`You put **${rupees(goalsAdded)}** towards your goals.`);
  if (prev && prev.expense > 0 && !inProgress) {
    const pct = Math.round(((totals.expense - prev.expense) / prev.expense) * 100);
    if (Math.abs(pct) >= 5) highlights.push(`You spent **${Math.abs(pct)}% ${pct > 0 ? "more" : "less"}** than the year before.`);
  }

  return {
    year: input.year,
    inProgress,
    enoughData: current.length >= MIN_YEAR_TRANSACTIONS,
    transactionCount: current.length,
    totals,
    previous: prev,
    months: byMonth.map(({ month, label, income, expense, saved }) => ({ month, label, income, expense, saved })),
    bestMonth: best ? { month: best.month, name: best.name, saved: best.saved } : null,
    toughestMonth: toughest && toughest.month !== best?.month ? { month: toughest.month, name: toughest.name, saved: toughest.saved } : null,
    categories,
    budgets,
    goals,
    goalsAdded,
    biggestExpense: biggest ? { amount: biggest.amount, category: biggest.category, note: biggest.note, date: biggest.date } : null,
    noSpendDays,
    daysCounted,
    highlights: highlights.slice(0, 4),
  };
}

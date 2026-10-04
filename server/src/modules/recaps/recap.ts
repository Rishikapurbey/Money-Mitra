// A look back at one finished month: totals, where the money went, budgets, goals and highlights.
// Pure: no database access, so every rule can be tested directly.

export interface RecapTransaction {
  amount: number;
  type: string;
  category: string;
  note: string | null;
  date: Date;
  recurringId: string | null;
}

export interface RecapInput {
  // YYYY-MM
  month: string;
  // Local midnight at the start of the month and of the next one, so days are counted in the user's timezone
  from: Date;
  to: Date;
  current: RecapTransaction[];
  previous: RecapTransaction[];
  budgets: { category: string; amount: number }[];
  goals: { name: string; savedAmount: number; targetAmount: number }[];
  monthName: string;
  previousMonthName: string;
}

export interface Totals {
  income: number;
  expense: number;
  saved: number;
  // Share of income kept, or null without income
  savingsRate: number | null;
}

export interface Recap {
  month: string;
  monthName: string;
  previousMonthName: string;
  // Too few entries to say anything useful; the rest is still filled in
  enoughData: boolean;
  transactionCount: number;
  totals: Totals;
  // Null when there were no entries the month before
  previous: Totals | null;
  categories: { name: string; amount: number; share: number; previous: number; changePct: number | null }[];
  budgets: { category: string; limit: number; spent: number; over: boolean }[];
  goals: { name: string; savedAmount: number; targetAmount: number; pct: number }[];
  biggestExpense: { amount: number; category: string; note: string | null; date: Date } | null;
  noSpendDays: number;
  daysInMonth: number;
  recurringTotal: number;
  // **double asterisks** mark text the app shows in bold
  wentWell: string | null;
  toWatch: string | null;
  learnSlug: string;
}

export const MIN_TRANSACTIONS = 3;
const MAX_CATEGORIES = 6;
// Changes smaller than this are noise, not news
const MIN_CHANGE_RUPEES = 500;
const MIN_CHANGE_PERCENT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const key = (category: string) => category.trim().toLowerCase();
const round2 = (n: number) => Math.round(n * 100) / 100;

function totalsOf(transactions: RecapTransaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  const saved = income - expense;
  return {
    income: round2(income),
    expense: round2(expense),
    saved: round2(saved),
    savingsRate: income > 0 ? Math.round((saved / income) * 100) : null,
  };
}

// Expense by category, matched case-insensitively, keeping the first spelling seen for display
function byCategory(transactions: RecapTransaction[]) {
  const map = new Map<string, { name: string; amount: number }>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const entry = map.get(key(t.category)) ?? { name: t.category.trim(), amount: 0 };
    entry.amount += t.amount;
    map.set(key(t.category), entry);
  }
  return map;
}

export function computeRecap(input: RecapInput): Recap {
  const { current, previous, from, to } = input;
  const totals = totalsOf(current);
  const prev = previous.length > 0 ? totalsOf(previous) : null;
  const curCategories = byCategory(current);
  const prevCategories = byCategory(previous);

  const categories = [...curCategories.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, MAX_CATEGORIES)
    .map(([k, { name, amount }]) => {
      const before = prevCategories.get(k)?.amount ?? 0;
      return {
        name,
        amount: round2(amount),
        share: totals.expense > 0 ? Math.round((amount / totals.expense) * 100) : 0,
        previous: round2(before),
        changePct: before > 0 ? Math.round(((amount - before) / before) * 100) : null,
      };
    });

  const budgets = input.budgets
    .filter((b) => b.amount > 0)
    .map((b) => {
      const spent = round2(curCategories.get(key(b.category))?.amount ?? 0);
      return { category: b.category, limit: b.amount, spent, over: spent > b.amount };
    })
    .sort((a, b) => Number(b.over) - Number(a.over) || b.spent / b.limit - a.spent / a.limit);

  const goals = input.goals.map((g) => ({
    name: g.name,
    savedAmount: g.savedAmount,
    targetAmount: g.targetAmount,
    pct: g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0,
  }));

  const expenses = current.filter((t) => t.type === "expense");
  const biggest = expenses.reduce<RecapTransaction | null>((top, t) => (!top || t.amount > top.amount ? t : top), null);

  // Local days (0 = the 1st) that had any spending
  const daysInMonth = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  const spendDays = new Set(expenses.map((t) => Math.floor((t.date.getTime() - from.getTime()) / DAY_MS)));
  const noSpendDays = Math.max(0, daysInMonth - spendDays.size);

  const recurringTotal = round2(expenses.filter((t) => t.recurringId).reduce((sum, t) => sum + t.amount, 0));

  // Biggest moves between categories, ignoring small ones
  type Change = { name: string; now: number; before: number; pct: number };
  let up: Change | null = null;
  let down: Change | null = null;
  for (const [k, { name, amount }] of curCategories) {
    const before = prevCategories.get(k)?.amount ?? 0;
    if (before <= 0) continue;
    const diff = amount - before;
    const pct = Math.round((diff / before) * 100);
    if (Math.abs(diff) < MIN_CHANGE_RUPEES || Math.abs(pct) < MIN_CHANGE_PERCENT) continue;
    if (diff > 0 && (!up || diff > up.now - up.before)) up = { name, now: amount, before, pct };
    if (diff < 0 && (!down || diff < down.now - down.before)) down = { name, now: amount, before, pct };
  }

  const overBudgets = budgets.filter((b) => b.over);
  const rate = totals.savingsRate;
  const prevRate = prev?.savingsRate ?? null;
  const { previousMonthName } = input;

  // The single best thing about the month, in order of how much it matters
  let wentWell: string | null = null;
  if (rate !== null && prevRate !== null && rate >= 0 && rate - prevRate >= 5) {
    wentWell = `You saved **${rate}%** of your income, up from ${prevRate}% in ${previousMonthName}.`;
  } else if (budgets.length > 0 && overBudgets.length === 0) {
    wentWell = budgets.length === 1 ? "You stayed **within your budget**." : `You stayed **within all ${budgets.length} budgets**.`;
  } else if (down) {
    wentWell = `You spent **${Math.abs(down.pct)}% less on ${down.name}** than in ${previousMonthName} (${rupees(down.now)} vs ${rupees(down.before)}).`;
  } else if (rate !== null && rate >= 20) {
    wentWell = `You saved **${rate}%** of your income.`;
  } else if (noSpendDays >= 5 && expenses.length > 0) {
    wentWell = `You had **${noSpendDays} days** without spending anything.`;
  }

  // The one thing most worth keeping an eye on
  let toWatch: string | null = null;
  if (totals.income > 0 && totals.expense > totals.income) {
    toWatch = `You spent **${rupees(totals.expense - totals.income)} more** than you earned.`;
  } else if (overBudgets[0]) {
    const worst = overBudgets[0];
    toWatch =
      overBudgets.length === 1
        ? `You went **${rupees(worst.spent - worst.limit)} over** your **${worst.category}** budget.`
        : `You went over **${overBudgets.length} budgets**, most of all **${worst.category}** (${rupees(worst.spent - worst.limit)} over).`;
  } else if (up) {
    toWatch = `You spent **${up.pct}% more on ${up.name}** than in ${previousMonthName} (${rupees(up.now)} vs ${rupees(up.before)}).`;
  } else if (rate !== null && prevRate !== null && rate >= 0 && prevRate - rate >= 5) {
    toWatch = `You saved **${rate}%** of your income, down from ${prevRate}% in ${previousMonthName}.`;
  }

  // A Learn term that fits how the month went
  let learnSlug = "budget";
  if (totals.saved >= 0 && overBudgets.length === 0 && rate !== null) {
    if (rate >= 30) learnSlug = "sip";
    else if (rate >= 10) learnSlug = "emergency-fund";
  }

  return {
    month: input.month,
    monthName: input.monthName,
    previousMonthName,
    enoughData: current.length >= MIN_TRANSACTIONS,
    transactionCount: current.length,
    totals,
    previous: prev,
    categories,
    budgets,
    goals,
    biggestExpense: biggest
      ? { amount: biggest.amount, category: biggest.category, note: biggest.note, date: biggest.date }
      : null,
    noSpendDays,
    daysInMonth,
    recurringTotal,
    wentWell,
    toWatch,
    learnSlug,
  };
}

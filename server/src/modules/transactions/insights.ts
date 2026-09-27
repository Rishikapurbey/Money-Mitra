// Turns a month of transactions into a few plain-English observations.
// Pure: no database access, so every rule can be tested directly.

export interface InsightTransaction {
  amount: number;
  type: string;
  category: string;
}

export interface InsightBudget {
  category: string;
  amount: number;
}

export type Tone = "good" | "warning" | "neutral";

export interface Insight {
  id: string;
  tone: Tone;
  // **double asterisks** mark text the app shows in bold
  message: string;
  learnSlug?: string;
}

interface InsightInput {
  current: InsightTransaction[];
  previous: InsightTransaction[];
  budgets: InsightBudget[];
  from: Date;
  to: Date;
  now: Date;
  previousMonthName: string;
}

interface CategoryChange {
  name: string;
  now: number;
  before: number;
  pct: number;
}

// Changes smaller than this are noise, not news
const MIN_CHANGE_RUPEES = 500;
const MIN_CHANGE_PERCENT = 20;
const MAX_INSIGHTS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const key = (category: string) => category.trim().toLowerCase();

function totals(transactions: InsightTransaction[]) {
  let income = 0;
  let expense = 0;
  // Expense by category, matched case-insensitively, keeping the most recent spelling for display
  const byCategory = new Map<string, { name: string; amount: number }>();
  for (const t of transactions) {
    if (t.type === "income") {
      income += t.amount;
      continue;
    }
    expense += t.amount;
    const entry = byCategory.get(key(t.category)) ?? { name: t.category.trim(), amount: 0 };
    entry.amount += t.amount;
    byCategory.set(key(t.category), entry);
  }
  return { income, expense, byCategory };
}

export function computeInsights({ current, previous, budgets, from, to, now, previousMonthName }: InsightInput): Insight[] {
  if (current.length < 3) {
    return [
      {
        id: "not-enough-data",
        tone: "neutral",
        message: "Add a few more transactions and I'll start spotting patterns in your spending.",
      },
    ];
  }

  const inProgress = now >= from && now < to;
  const daysLeft = Math.max(1, Math.ceil((to.getTime() - now.getTime()) / DAY_MS));
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - from.getTime()) / (to.getTime() - from.getTime())));
  const cur = totals(current);
  const prev = totals(previous);
  const found: (Insight & { priority: number })[] = [];

  // Budgets: over, or close to the limit while the month is still running
  for (const budget of budgets) {
    const spent = cur.byCategory.get(key(budget.category))?.amount ?? 0;
    if (spent > budget.amount) {
      found.push({
        id: `over-budget-${key(budget.category)}`,
        tone: "warning",
        priority: 100,
        message: `${inProgress ? "You've gone" : "You went"} **${rupees(spent - budget.amount)} over** your **${budget.category}** budget.`,
      });
    } else if (inProgress && spent >= budget.amount * 0.8) {
      found.push({
        id: `near-budget-${key(budget.category)}`,
        tone: "warning",
        priority: 90,
        message: `**${budget.category}** is at **${Math.round((spent / budget.amount) * 100)}%** of its budget with **${daysLeft} day${daysLeft === 1 ? "" : "s"}** to go.`,
      });
    }
  }

  // Spending more than was earned
  if (cur.income > 0 && cur.expense > cur.income) {
    found.push({
      id: "spent-more-than-earned",
      tone: "warning",
      priority: 95,
      message: `${inProgress ? "You've spent" : "You spent"} **${rupees(cur.expense - cur.income)} more** than you earned this month.`,
      learnSlug: "budget",
    });
  }

  // Savings rate, compared with last month when both months have income. While the month is running
  // the rate only looks better than it will end up (salary arrives early, spending comes later),
  // so good news waits until the month is over; a rate that is already lower is still worth saying.
  if (cur.income > 0) {
    const rate = Math.round(((cur.income - cur.expense) / cur.income) * 100);
    const prevRate = prev.income > 0 ? Math.round(((prev.income - prev.expense) / prev.income) * 100) : null;
    if (rate >= 0 && prevRate !== null && Math.abs(rate - prevRate) >= 5 && !(inProgress && rate > prevRate)) {
      const up = rate > prevRate;
      found.push({
        id: "savings-rate-change",
        tone: up ? "good" : "warning",
        priority: 60,
        message: up
          ? `Nice: you ${inProgress ? "have saved" : "saved"} **${rate}%** of your income, up from ${prevRate}% in ${previousMonthName}.`
          : `You ${inProgress ? "have saved" : "saved"} **${rate}%** of your income, down from ${prevRate}% in ${previousMonthName}.`,
      });
    } else if (rate >= 20 && !inProgress) {
      found.push({
        id: "savings-rate",
        tone: "good",
        priority: 40,
        message: `Nice: you saved **${rate}%** of your income this month.`,
      });
    }
  }

  // Category changes vs last month. While the month is running, only increases are fair to report:
  // a few days in, every category looks "down" compared with a whole previous month.
  let biggestUp: CategoryChange | null = null;
  let biggestDown: CategoryChange | null = null;
  for (const [k, { name, amount }] of cur.byCategory) {
    const before = prev.byCategory.get(k)?.amount ?? 0;
    if (before <= 0) continue;
    const diff = amount - before;
    const pct = Math.round((diff / before) * 100);
    if (Math.abs(diff) < MIN_CHANGE_RUPEES || Math.abs(pct) < MIN_CHANGE_PERCENT) continue;
    if (diff > 0 && (!biggestUp || diff > biggestUp.now - biggestUp.before)) biggestUp = { name, now: amount, before, pct };
    if (diff < 0 && !inProgress && (!biggestDown || diff < biggestDown.now - biggestDown.before)) {
      biggestDown = { name, now: amount, before, pct };
    }
  }
  if (biggestUp) {
    found.push({
      id: "category-up",
      tone: "warning",
      priority: 70,
      message: inProgress
        ? `You've already spent **${biggestUp.pct}% more on ${biggestUp.name}** than in all of ${previousMonthName} (${rupees(biggestUp.now)} vs ${rupees(biggestUp.before)}).`
        : `You spent **${biggestUp.pct}% more on ${biggestUp.name}** than in ${previousMonthName} (${rupees(biggestUp.now)} vs ${rupees(biggestUp.before)}).`,
    });
  }
  if (biggestDown) {
    found.push({
      id: "category-down",
      tone: "good",
      priority: 50,
      message: `Nice: **${biggestDown.name}** was **down ${Math.abs(biggestDown.pct)}%** from ${previousMonthName} (${rupees(biggestDown.now)} vs ${rupees(biggestDown.before)}).`,
    });
  }

  // Where the month is heading, once enough of it has passed to project fairly
  if (inProgress && elapsed >= 0.2 && elapsed < 0.97 && cur.expense > 0) {
    // An estimate should read like one: round to the nearest ₹100
    const projected = Math.round(cur.expense / elapsed / 100) * 100;
    const diff = Math.round((projected - prev.expense) / 100) * 100;
    if (prev.expense > 0 && Math.abs(diff) >= MIN_CHANGE_RUPEES && Math.abs(diff) / prev.expense >= 0.1) {
      found.push({
        id: "pace",
        tone: diff > 0 ? "warning" : "good",
        priority: 55,
        message: `At this pace you'll spend about **${rupees(projected)}** this month, ${rupees(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than ${previousMonthName}.`,
      });
    } else if (prev.expense === 0) {
      found.push({
        id: "pace",
        tone: "neutral",
        priority: 35,
        message: `At this pace you'll spend about **${rupees(projected)}** this month.`,
      });
    }
  }

  // The biggest single expense, when it takes a large share
  const top = [...cur.byCategory.values()].sort((a, b) => b.amount - a.amount)[0];
  if (top && cur.expense > 0 && top.amount / cur.expense >= 0.3) {
    found.push({
      id: "top-category",
      tone: "neutral",
      priority: 30,
      message: `**${top.name}** ${inProgress ? "is" : "was"} your biggest expense, at **${Math.round((top.amount / cur.expense) * 100)}%** of your spending.`,
    });
  }

  return found
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_INSIGHTS)
    .map(({ priority: _priority, ...insight }) => insight);
}

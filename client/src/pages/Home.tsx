import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ArrowRight, Calculator, MessageCircle, MessagesSquare, Minus, Plus, Target } from "lucide-react";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { formatINR } from "../lib/ui";
import { addMonths, startOfMonth } from "../lib/dates";
import { onDataChange } from "../lib/dataEvents";
import { timeAgo } from "../lib/discuss";
import type { Post } from "../lib/discuss";
import type { AppContext } from "../components/AppLayout";
import GettingStarted from "../components/GettingStarted";
import InsightsCard from "../components/InsightsCard";
import type { Insight } from "../components/InsightsCard";
import LearnTipCard from "../components/LearnTipCard";
import QuickAddSheet from "../components/QuickAddSheet";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
}

interface HomeData {
  income: number;
  expense: number;
  totalBalance: number;
  expenseByCategory: Record<string, { name: string; amount: number }>;
  budgets: { category: string; amount: number }[];
  goals: Goal[];
  insights: Insight[];
  posts: Post[];
}

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// Everything Home shows for the current month, or null if the essentials couldn't be loaded
async function fetchHome(): Promise<HomeData | null> {
  const month = startOfMonth(new Date());
  const range = { from: month.toISOString(), to: addMonths(month, 1).toISOString() };
  try {
    const [txRes, summaryRes, budgetsRes, goalsRes, insights, posts] = await Promise.all([
      api.get("/transactions", { params: range }),
      api.get("/transactions/summary", { params: range }),
      api.get("/budgets"),
      api.get("/goals"),
      // The extras below are nice to have; Home still loads without them
      api
        .get("/transactions/insights", {
          params: { ...range, prevFrom: addMonths(month, -1).toISOString(), tzOffset: new Date().getTimezoneOffset() },
        })
        .then((r) => r.data.insights as Insight[])
        .catch(() => []),
      api.get("/posts").then((r) => r.data.posts as Post[]).catch(() => []),
    ]);

    const expenseByCategory: HomeData["expenseByCategory"] = {};
    for (const t of txRes.data.transactions as { type: string; category: string; amount: number }[]) {
      if (t.type !== "expense") continue;
      const key = t.category.trim().toLowerCase();
      expenseByCategory[key] = { name: t.category, amount: (expenseByCategory[key]?.amount ?? 0) + t.amount };
    }
    const { income, expense, totalBalance } = summaryRes.data.summary;
    return {
      income,
      expense,
      totalBalance,
      expenseByCategory,
      budgets: budgetsRes.data.budgets,
      goals: goalsRes.data.goals,
      insights,
      posts,
    };
  } catch {
    return null;
  }
}

function Home() {
  useTitle("Home");
  const { username } = useOutletContext<AppContext>();
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);
  const [quickAdd, setQuickAdd] = useState<"expense" | "income" | null>(null);

  const apply = useCallback((result: HomeData | null) => {
    if (result) {
      setData(result);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, []);

  const reload = useCallback(async () => apply(await fetchHome()), [apply]);

  useEffect(() => {
    let current = true;
    fetchHome().then((result) => current && apply(result));
    // Budgets or goals changed elsewhere (e.g. from the checklist): refresh
    const stop = onDataChange(() => fetchHome().then((result) => current && apply(result)));
    return () => {
      current = false;
      stop();
    };
  }, [apply]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const monthLabel = new Date().toLocaleDateString("en-IN", { month: "long" });

  if (failed && !data) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div role="alert" className="bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3">
          We couldn't load your home page. Check your connection and try again.
          <button onClick={reload} className="font-medium underline underline-offset-2">Retry</button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-pulse">
        <div className="h-7 w-64 bg-ink-200 rounded" />
        <div className="h-40 bg-ink-200 rounded-2xl" />
        <div className="h-20 bg-ink-100 rounded-2xl" />
        <div className="h-56 bg-ink-100 rounded-2xl" />
      </main>
    );
  }

  const savingsRate = data.income > 0 ? Math.round(((data.income - data.expense) / data.income) * 100) : null;
  const tightest = data.budgets
    .map((b) => ({ ...b, spent: data.expenseByCategory[b.category.trim().toLowerCase()]?.amount ?? 0 }))
    .map((b) => ({ ...b, pct: Math.round((b.spent / b.amount) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0];
  const openGoals = data.goals
    .filter((g) => g.savedAmount < g.targetAmount)
    .sort((a, b) => b.savedAmount / b.targetAmount - a.savedAmount / a.targetAmount)
    .slice(0, 2);
  // Unanswered questions first, so people see where they can help
  const community = [...data.posts]
    .sort((a, b) => Number((a.replyCount ?? 0) > 0) - Number((b.replyCount ?? 0) > 0))
    .slice(0, 3);
  const categories = Object.values(data.expenseByCategory).map((c) => c.name);
  const hasTransactions = data.income > 0 || data.expense > 0 || data.totalBalance !== 0;

  const quickActions = [
    { label: "Add expense", icon: Minus, onClick: () => setQuickAdd("expense") },
    { label: "Add income", icon: Plus, onClick: () => setQuickAdd("income") },
    { label: "Ask a question", icon: MessagesSquare, to: "/discuss?ask=1" },
    { label: "Calculators", icon: Calculator, to: "/calculators" },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {greeting()}{username && `, ${username}`}
        </h1>
        <p className="mt-1 text-sm text-ink-500">{today}</p>
      </div>

      <GettingStarted hasTransactions={hasTransactions} onAddTransaction={() => setQuickAdd("expense")} />

      {/* This month at a glance */}
      <section className="bg-ink-900 rounded-2xl p-6 sm:p-7 text-white" aria-labelledby="glance-title">
        <div className="flex items-center justify-between gap-4">
          <h2 id="glance-title" className="text-xs font-medium uppercase tracking-wider text-ink-300">
            {monthLabel} at a glance
          </h2>
          <Link to="/tracker" className="inline-flex items-center gap-1 text-sm font-medium text-brand-300 hover:text-white transition">
            Open tracker <ArrowRight size={14} />
          </Link>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-ink-300">Spent</dt>
            <dd className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{formatINR(data.expense)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-300">Earned</dt>
            <dd className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{formatINR(data.income)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-300">Saved</dt>
            <dd className={`mt-1 text-xl sm:text-2xl font-semibold tabular-nums ${savingsRate !== null && savingsRate < 0 ? "text-[#f3a3a8]" : ""}`}>
              {savingsRate === null ? "–" : `${savingsRate}%`}
            </dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-ink-800 pt-4">
          {tightest ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-ink-300">
                  Tightest budget: <span className="text-white font-medium">{tightest.category}</span>
                </span>
                <span className="tabular-nums text-ink-300">
                  {formatINR(tightest.spent)} of {formatINR(tightest.amount)}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-ink-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${tightest.pct > 100 ? "bg-loss" : tightest.pct >= 80 ? "bg-warn" : "bg-brand-300"}`}
                  style={{ width: `${Math.min(tightest.pct, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <Link to="/tracker#budgets" className="text-sm text-ink-300 hover:text-white transition">
              Set a monthly budget to see how close you are as you spend →
            </Link>
          )}
        </div>
      </section>

      {/* Quick actions */}
      <nav aria-label="Quick actions" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map(({ label, icon: Icon, onClick, to }) => {
          const className =
            "flex flex-col items-start gap-3 bg-surface border border-line rounded-2xl p-4 text-left font-medium text-ink-900 hover:border-ink-300 transition";
          const inner = (
            <>
              <span className="bg-brand-50 text-brand-600 p-2 rounded-xl">
                <Icon size={18} />
              </span>
              {label}
            </>
          );
          return to ? (
            <Link key={label} to={to} className={className}>{inner}</Link>
          ) : (
            <button key={label} onClick={onClick} className={className}>{inner}</button>
          );
        })}
      </nav>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:flex-[2] min-w-0">
          <InsightsCard insights={data.insights} monthLabel={monthLabel} isCurrentMonth />
        </div>
        <div className="md:flex-1 min-w-0 flex">
          <LearnTipCard income={data.income} expense={data.expense} categories={categories} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="bg-surface border border-line rounded-2xl p-6" aria-labelledby="home-goals">
          <div className="flex items-center justify-between gap-3">
            <h2 id="home-goals" className="font-semibold text-ink-900">Your goals</h2>
            <Link to="/tracker#goals" className="text-sm font-medium text-brand-600 hover:text-brand-700">See all</Link>
          </div>
          {openGoals.length === 0 ? (
            <div className="mt-4 flex items-start gap-3 text-sm text-ink-500">
              <Target size={18} className="shrink-0 text-brand-600 mt-0.5" />
              <p>
                Saving for something?{" "}
                <Link to="/tracker#goals" className="font-medium text-brand-600 hover:text-brand-700">Create a goal</Link> and
                watch it grow.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {openGoals.map((g) => (
                <li key={g.id}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium text-ink-900 truncate">{g.name}</span>
                    <span className="text-ink-500 tabular-nums shrink-0">
                      <span className="text-ink-900 font-medium">{formatINR(g.savedAmount)}</span> of {formatINR(g.targetAmount)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(g.savedAmount / g.targetAmount) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-surface border border-line rounded-2xl p-6" aria-labelledby="home-community">
          <div className="flex items-center justify-between gap-3">
            <h2 id="home-community" className="font-semibold text-ink-900">From the community</h2>
            <Link to="/discuss" className="text-sm font-medium text-brand-600 hover:text-brand-700">Discuss</Link>
          </div>
          {community.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">
              No questions yet.{" "}
              <Link to="/discuss?ask=1" className="font-medium text-brand-600 hover:text-brand-700">Be the first to ask</Link>.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {community.map((post) => (
                <li key={post.id}>
                  <Link to={`/discuss/${post.id}`} className="block py-3 group">
                    <p className="text-sm font-medium text-ink-900 group-hover:text-brand-700 transition line-clamp-2">{post.title}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                      <span>{post.topic}</span>
                      <span>·</span>
                      <span>{timeAgo(post.createdAt)}</span>
                      {(post.replyCount ?? 0) === 0 && !post.isMine ? (
                        <span className="ml-auto font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">Can you help?</span>
                      ) : (
                        <span className="ml-auto flex items-center gap-1">
                          <MessageCircle size={12} /> {post.replyCount ?? 0}
                        </span>
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {quickAdd && (
        <QuickAddSheet type={quickAdd} recentCategories={categories} onClose={() => setQuickAdd(null)} onSaved={reload} />
      )}
    </main>
  );
}

export default Home;

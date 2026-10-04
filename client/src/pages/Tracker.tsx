import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { useTitle } from "../lib/useTitle";
import { formatINR, inputClass, pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { addMonths, startOfMonth, toInputDate, transactionTimestamp } from "../lib/dates";
import BudgetsCard from "../components/BudgetsCard";
import GoalsCard from "../components/GoalsCard";
import RecurringCard from "../components/RecurringCard";
import TransactionsCard from "../components/TransactionsCard";
import type { Transaction } from "../components/TransactionsCard";
import { announceDataChange, onDataChange } from "../lib/dataEvents";
import { ordinal } from "../lib/recurring";
import { monthKey } from "../lib/recap";
import { quickPicks, useCategories } from "../lib/categories";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertCircle, TrendingUp, TrendingDown, Wallet2, Plus, ChevronLeft, ChevronRight, Upload, CalendarCheck } from "lucide-react";
import { withBudgetAlert } from "../lib/budgetAlerts";
import type { BudgetAlert } from "../lib/budgetAlerts";

const COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-chart-${n})`);


const monthName = (d: Date) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

interface DashboardData {
  transactions: Transaction[];
  summary: { income: number; expense: number; balance: number; totalBalance: number };
  trend: { month: string; income: number; expense: number }[];
}

// Everything the dashboard shows for one month, or null if it couldn't be loaded
async function fetchDashboard(month: Date): Promise<DashboardData | null> {
  try {
    const range = { from: month.toISOString(), to: addMonths(month, 1).toISOString() };
    const trendParams = {
      from: addMonths(startOfMonth(new Date()), -5).toISOString(),
      tzOffset: new Date().getTimezoneOffset(),
    };
    const [txRes, summaryRes, trendRes] = await Promise.all([
      api.get("/transactions", { params: range }),
      api.get("/transactions/summary", { params: range }),
      api.get("/transactions/trend", { params: trendParams }),
    ]);
    return { transactions: txRes.data.transactions, summary: summaryRes.data.summary, trend: trendRes.data.trend };
  } catch {
    return null;
  }
}

function Tracker() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0, totalBalance: 0 });
  const [trend, setTrend] = useState<{ month: string; income: number; expense: number }[]>([]);
  // An import can send the user here to see the month it covered (a YYYY-MM-DD day in that month)
  const openOn = (useLocation().state as { month?: string } | null)?.month;
  const [month, setMonth] = useState(() => startOfMonth(openOn ? new Date(`${openOn}T00:00:00`) : new Date()));
  const toast = useToast();
  const wide = useWideLayout();
  useTitle("Tracker");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [editingOriginalDate, setEditingOriginalDate] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [repeatEnd, setRepeatEnd] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Reloaded along with the month's data, so a category added with a transaction appears straight away
  const { categories: savedCategories } = useCategories(transactions);

  const applyData = useCallback((data: DashboardData | null) => {
    if (data) {
      setTransactions(data.transactions);
      setSummary(data.summary);
      setTrend(data.trend);
      setError("");
    } else {
      setError("We couldn't load your data. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  // Reload after adding, editing or deleting
  const loadData = useCallback(async () => applyData(await fetchDashboard(month)), [month, applyData]);

  // Ignore a response that arrives after the user has already moved to another month
  useEffect(() => {
    let current = true;
    const load = () => fetchDashboard(month).then((data) => current && applyData(data));
    load();
    // e.g. recurring entries were just added, or a rule was stopped
    const stop = onDataChange(load);
    return () => {
      current = false;
      stop();
    };
  }, [month, applyData]);

  const resetForm = () => {
    setAmount("");
    setCategory("");
    setNote("");
    setType("expense");
    setDate(toInputDate(new Date()));
    setEditingOriginalDate(null);
    setRepeat(false);
    setRepeatEnd("");
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Keep the exact original timestamp if the day wasn't changed; use the current
    // time for today, and midday for other days so timezone shifts can't change the date
    let when: string;
    if (editingOriginalDate && toInputDate(new Date(editingOriginalDate)) === date) when = editingOriginalDate;
    else when = transactionTimestamp(date);

    const body = { amount: parseFloat(amount), type, category, note, date: when, tzOffset: new Date().getTimezoneOffset() };
    let createdId: string | null = null;
    let budgetAlert: BudgetAlert | null;
    try {
      if (editingId) {
        budgetAlert = (await api.put(`/transactions/${editingId}`, body)).data.budgetAlert;
      } else {
        const res = await api.post("/transactions", body);
        createdId = res.data.transaction.id;
        budgetAlert = res.data.budgetAlert;
      }
    } catch {
      setError("We couldn't save that transaction. Please try again.");
      return;
    }

    // "Repeat every month": this entry becomes the first one, and the next is added next month
    const repeatDay = Number(date.slice(8, 10));
    let repeating = false;
    if (createdId && repeat) {
      try {
        await api.post("/recurring", {
          amount: body.amount,
          type,
          category,
          note,
          dayOfMonth: repeatDay,
          tzOffset: new Date().getTimezoneOffset(),
          firstEntryId: createdId,
          endDate: repeatEnd ? new Date(`${repeatEnd}T23:59:59`).toISOString() : null,
        });
        repeating = true;
        announceDataChange();
      } catch {
        setError("The transaction was added, but we couldn't set it to repeat. Try again from the Recurring card.");
      }
    }
    const savedCategory = category;
    const wasEditing = Boolean(editingId);
    resetForm();
    const targetMonth = startOfMonth(new Date(when));
    const otherMonth = targetMonth.getTime() !== month.getTime();
    if (otherMonth) setMonth(targetMonth);
    else loadData();
    const saved = wasEditing
      ? "Changes saved"
      : repeating
        ? `${savedCategory} added. It will repeat on the ${ordinal(repeatDay)} of every month.`
        : otherMonth
          ? `Transaction added to ${monthName(targetMonth)}`
          : "Transaction added";
    toast({ message: withBudgetAlert(saved, budgetAlert) });
  };

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    setAmount(String(t.amount));
    setType(t.type);
    setCategory(t.category);
    setNote(t.note || "");
    setDate(toInputDate(new Date(t.date)));
    setEditingOriginalDate(t.date);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Deleting is immediate; Undo adds the same transaction back with its original date
  const handleDelete = async (t: Transaction) => {
    try {
      await api.delete(`/transactions/${t.id}`);
    } catch {
      setError("We couldn't delete that transaction. Please try again.");
      return;
    }
    loadData();
    toast({
      message: "Transaction deleted",
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await api.post("/transactions", {
              amount: t.amount,
              type: t.type,
              category: t.category,
              note: t.note,
              date: t.date,
              tzOffset: new Date().getTimezoneOffset(),
            });
            loadData();
            toast({ message: "Transaction restored" });
          } catch {
            setError("We couldn't restore that transaction. Please add it again.");
          }
        },
      },
    });
  };

  const categories = Array.from(new Set(transactions.map((t) => t.category)));

  // This month's most-used categories for the selected type first, then the rest of the user's list
  const categoryCounts = transactions
    .filter((t) => t.type === type)
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {});
  const quickCategories = quickPicks(
    Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]),
    savedCategories,
    type
  );
  const typeCategories = savedCategories.filter((c) => c.type === type);

  const chartData = Object.values(
    transactions
      .filter((t) => t.type === "expense")
      .reduce((acc: Record<string, { name: string; value: number }>, t) => {
        if (!acc[t.category]) acc[t.category] = { name: t.category, value: 0 };
        acc[t.category].value += t.amount;
        return acc;
      }, {})
  ).sort((a, b) => b.value - a.value);
  const totalSpent = chartData.reduce((sum, d) => sum + d.value, 0);

  // Same color for a category in the chart, legend and transaction list
  const colorOf: Record<string, string> = {};
  [...chartData.map((d) => d.name), ...categories].forEach((c) => {
    if (!(c in colorOf)) colorOf[c] = COLORS[Object.keys(colorOf).length % COLORS.length];
  });
  // Categories from other months (in search results) get a stable colour from their name
  const colorFor = (c: string) =>
    colorOf[c] ?? COLORS[[...c].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) % COLORS.length];

  const isCurrentMonth = month.getTime() === startOfMonth(new Date()).getTime();
  const monthShort = month.toLocaleDateString("en-IN", { month: "long" });
  const trendData = trend.map((m) => ({
    ...m,
    label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" }),
  }));
  const hasTrend = trend.some((m) => m.income > 0 || m.expense > 0);

  const savingsRate = summary.income > 0 ? Math.round((summary.balance / summary.income) * 100) : null;

  if (loading) {
    return (
      <main className={`${pageWidth} py-8 space-y-6 animate-pulse`}>
        <div className="h-6 w-56 bg-ink-200 rounded" />
        <div className="h-52 bg-ink-200 rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3 h-72 bg-ink-100 rounded-2xl" />
          <div className="md:col-span-2 h-72 bg-ink-100 rounded-2xl" />
        </div>
        <div className="h-64 bg-ink-100 rounded-2xl" />
      </main>
    );
  }

  const errorBanner = error && (
    <div role="alert" className="flex items-center gap-3 bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
      <AlertCircle size={18} className="shrink-0" />
      <span className="flex-1">{error}</span>
      <button onClick={loadData} className="font-medium underline underline-offset-2 hover:no-underline">
        Retry
      </button>
    </div>
  );

  const pageHeader = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Tracker</h1>
        <p className="mt-1 text-sm text-ink-500">Every rupee in and out, month by month.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!isCurrentMonth && (
          <Link
            to={`/tracker/recap/${monthKey(month)}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-surface text-sm font-medium text-ink-900 hover:bg-ink-100 transition"
          >
            <CalendarCheck size={16} /> See recap
          </Link>
        )}
        <Link
          to="/tracker/import"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-surface text-sm font-medium text-ink-900 hover:bg-ink-100 transition"
        >
          <Upload size={16} /> Import
        </Link>
        <div className="flex items-center bg-surface border border-line rounded-xl">
          <button
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Previous month"
            className="p-2.5 text-ink-500 hover:text-ink-900 transition"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="w-36 text-center text-sm font-medium text-ink-900">{monthName(month)}</span>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="p-2.5 text-ink-500 hover:text-ink-900 transition disabled:text-ink-200 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  const balanceCard = (
    <section className="dark-panel bg-ink-900 rounded-2xl p-6 sm:p-8 text-white lg:flex lg:items-end lg:justify-between lg:gap-10">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-ink-300 text-xs font-medium uppercase tracking-wider">
          <Wallet2 size={14} /> Balance
        </div>
        <p className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums">{formatINR(summary.totalBalance)}</p>
        {savingsRate !== null && (
          <div className="mt-4 max-w-sm">
            <p className="text-sm text-ink-300">
              {savingsRate >= 0
                ? `You saved ${savingsRate}% of your income in ${monthShort}`
                : `You spent ${Math.abs(savingsRate)}% more than your income in ${monthShort}`}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-ink-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${savingsRate >= 0 ? "bg-brand-300" : "bg-loss"}`}
                style={{ width: `${Math.min(Math.abs(savingsRate), 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {/* Beside the balance on wider screens, below it on phones */}
      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-800 pt-5 lg:mt-0 lg:shrink-0 lg:gap-10 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-10">
        <div>
          <div className="flex items-center gap-1.5 text-ink-300 text-xs font-medium uppercase tracking-wider">
            <TrendingUp size={14} className="text-brand-300" /> Income in {monthShort}
          </div>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatINR(summary.income)}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-ink-300 text-xs font-medium uppercase tracking-wider">
            <TrendingDown size={14} className="text-ink-400" /> Expense in {monthShort}
          </div>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatINR(summary.expense)}</p>
        </div>
      </div>
    </section>
  );

  const addForm = (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={`bg-surface p-6 rounded-2xl border space-y-4 transition ${
        editingId ? "border-brand-500 ring-2 ring-brand-100" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">{editingId ? "Edit transaction" : "Add transaction"}</h2>
        {editingId && (
          <span className="text-xs font-medium uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-1 rounded-md">
            Editing
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`py-2 rounded-lg capitalize transition ${
              type === t ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500 font-medium">₹</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} w-full pl-9 text-lg font-semibold tabular-nums`}
            required
          />
        </div>
        <input
          type="date"
          value={date}
          max={toInputDate(new Date())}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className={`${inputClass} w-full`}
          required
        />
      </div>

      <div>
        <input
          type="text"
          placeholder="Category (e.g. Food, Rent, Salary)"
          maxLength={50}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="tracker-categories"
          autoComplete="off"
          className={`${inputClass} w-full`}
          required
        />
        <datalist id="tracker-categories">
          {typeCategories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        {quickCategories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {quickCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  category === c
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-line text-ink-700 hover:border-ink-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        type="text"
        placeholder="Note (optional)"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className={`${inputClass} w-full`}
      />

      {!editingId && (
        <div className="rounded-xl border border-line p-3 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-ink-900">
              Repeat every month
              <span className="text-ink-500"> on the {ordinal(Number(date.slice(8, 10)) || 1)}</span>
            </span>
          </label>
          {repeat && (
            <label className="flex flex-wrap items-center gap-3 text-sm text-ink-500">
              Ends (optional)
              <input
                type="date"
                value={repeatEnd}
                min={date}
                onChange={(e) => setRepeatEnd(e.target.value)}
                className={`${inputClass} py-1.5`}
              />
            </label>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" className="flex items-center gap-1.5 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition">
          <Plus size={16} /> {editingId ? "Save changes" : "Add transaction"}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="px-5 py-2.5 rounded-xl border border-line text-ink-700 hover:bg-ink-100 transition">
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  const spendingCard = (
    <section className="bg-surface p-6 rounded-2xl border border-line">
      <h2 className="font-semibold text-ink-900">Spending by category</h2>
      {chartData.length > 0 ? (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none">
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={colorOf[d.name]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-ink-500">Total spent</span>
              <span className="text-lg font-semibold text-ink-900 tabular-nums">{formatINR(totalSpent)}</span>
            </div>
          </div>
          <ul className="mt-2 space-y-2">
            {chartData.map((d) => (
              <li key={d.name} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf[d.name] }} />
                <span className="text-ink-700 truncate flex-1">{d.name}</span>
                <span className="text-ink-900 font-medium tabular-nums">{formatINR(d.value)}</span>
                <span className="text-ink-500 tabular-nums w-10 text-right">
                  {Math.round((d.value / totalSpent) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-500">No expenses in {monthName(month)} yet.</p>
      )}
    </section>
  );

  const budgetsCard = (
    <BudgetsCard
      expenses={transactions.filter((t) => t.type === "expense")}
      monthLabel={monthName(month)}
      categories={categories}
    />
  );

  const trendCard = (
    <section className="bg-surface p-6 rounded-2xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-ink-900">
          Last 6 months{" "}
          <Link to={`/tracker/year/${month.getFullYear()}`} className="ml-2 text-sm font-medium text-brand-600 hover:underline">
            See your {month.getFullYear()}
          </Link>
        </h2>
        <div className="flex items-center gap-4 text-sm text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-chart-1" /> Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-chart-2" /> Expense
          </span>
        </div>
      </div>
      {hasTrend ? (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barGap={4} margin={{ left: 0, right: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-500)", fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "var(--color-ink-500)", fontSize: 12 }}
                tickFormatter={(v) => "₹" + Number(v).toLocaleString("en-IN", { notation: "compact" })}
              />
              <Tooltip cursor={{ fill: "var(--color-ink-100)" }} formatter={(v) => formatINR(Number(v))} />
              <Bar dataKey="income" name="Income" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expense" name="Expense" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-500">Your monthly trend will appear here as you add transactions.</p>
      )}
    </section>
  );

  const transactionsCard = (
    <TransactionsCard
      month={month}
      monthTransactions={transactions}
      isCurrentMonth={isCurrentMonth}
      wide={wide}
      colorFor={colorFor}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      {errorBanner}
      {pageHeader}

      {wide ? (
        // Wide screens: the month's numbers on the left; adding and planning in a rail that stays in view
        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            {balanceCard}
            <div className="grid grid-cols-5 gap-6">
              <div className="col-span-2 [&>section]:h-full">{spendingCard}</div>
              <div className="col-span-3 [&>section]:h-full">{trendCard}</div>
            </div>
            {transactionsCard}
          </div>
          <aside
            className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-6 pb-2 -mr-1 pr-1"
            aria-label="Add and plan"
          >
            {addForm}
            {budgetsCard}
            <GoalsCard />
            <RecurringCard />
          </aside>
        </div>
      ) : (
        <>
          {balanceCard}
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3">{addForm}</div>
            <div className="md:col-span-2">{spendingCard}</div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {budgetsCard}
            <GoalsCard />
          </div>
          <RecurringCard />
          {trendCard}
          {transactionsCard}
        </>
      )}
    </main>
  );
}

export default Tracker;

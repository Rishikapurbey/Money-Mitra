import { useCallback, useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { useTitle } from "../lib/useTitle";
import { formatINR, inputClass } from "../lib/ui";
import { addMonths, startOfMonth, toInputDate, transactionTimestamp } from "../lib/dates";
import BudgetsCard from "../components/BudgetsCard";
import GoalsCard from "../components/GoalsCard";
import RecurringCard from "../components/RecurringCard";
import { announceDataChange, onDataChange } from "../lib/dataEvents";
import { ordinal } from "../lib/recurring";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertCircle, TrendingUp, TrendingDown, Wallet2, Pencil, Trash2, Plus, Receipt, ChevronLeft, ChevronRight, Repeat } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  note?: string;
  date: string;
  recurringId?: string | null;
}

const COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-chart-${n})`);


const monthName = (d: Date) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

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
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const toast = useToast();
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
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const formRef = useRef<HTMLFormElement>(null);

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

    const body = { amount: parseFloat(amount), type, category, note, date: when };
    let createdId: string | null = null;
    try {
      if (editingId) {
        await api.put(`/transactions/${editingId}`, body);
      } else {
        createdId = (await api.post("/transactions", body)).data.transaction.id;
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
    toast({
      message: wasEditing
        ? "Changes saved"
        : repeating
          ? `${savedCategory} added. It will repeat on the ${ordinal(repeatDay)} of every month.`
          : otherMonth
            ? `Transaction added to ${monthName(targetMonth)}`
            : "Transaction added",
    });
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
            await api.post("/transactions", { amount: t.amount, type: t.type, category: t.category, note: t.note, date: t.date });
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

  // Most-used categories for the selected type, offered as quick picks
  const categoryCounts = transactions
    .filter((t) => t.type === type)
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {});
  const quickCategories = Object.keys(categoryCounts)
    .sort((a, b) => categoryCounts[b] - categoryCounts[a])
    .slice(0, 6);

  const filtered = transactions.filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const grouped = filtered.reduce((acc: { label: string; items: Transaction[] }[], t) => {
    const label = dayLabel(t.date);
    const last = acc[acc.length - 1];
    if (last && last.label === label) last.items.push(t);
    else acc.push({ label, items: [t] });
    return acc;
  }, []);

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-pulse">
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

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {error && (
        <div role="alert" className="flex items-center gap-3 bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={loadData} className="font-medium underline underline-offset-2 hover:no-underline">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Tracker</h1>
          <p className="mt-1 text-sm text-ink-500">Every rupee in and out, month by month.</p>
        </div>
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

      <section className="dark-panel bg-ink-900 rounded-2xl p-6 sm:p-8 text-white">
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
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-800 pt-5">
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

      <div className="grid gap-6 md:grid-cols-5">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className={`md:col-span-3 bg-surface p-6 rounded-2xl border space-y-4 transition ${
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
              className={`${inputClass} w-full`}
              required
            />
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

        <section className="md:col-span-2 bg-surface p-6 rounded-2xl border border-line">
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <BudgetsCard
          expenses={transactions.filter((t) => t.type === "expense")}
          monthLabel={monthName(month)}
          categories={categories}
        />
        <GoalsCard />
      </div>

      <RecurringCard />

      <section className="bg-surface p-6 rounded-2xl border border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink-900">Last 6 months</h2>
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

      <section className="bg-surface rounded-2xl border border-line overflow-hidden">
        <div className="flex flex-wrap gap-3 justify-between items-center p-5 border-b border-line">
          <h2 className="font-semibold text-ink-900">Transactions</h2>
          <div className="flex gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={`${inputClass} py-1.5 text-sm`}>
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={`${inputClass} py-1.5 text-sm`}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
              <Receipt size={22} className="text-brand-600" />
            </div>
            <p className="mt-4 font-medium text-ink-900">No transactions in {monthName(month)}</p>
            <p className="mt-1 text-sm text-ink-500">
              {isCurrentMonth ? "Add an income or expense above to start tracking." : "Nothing was recorded this month."}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-ink-500 text-sm">No transactions match these filters.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              <p className="px-5 py-2 bg-canvas text-xs font-medium uppercase tracking-wider text-ink-500 border-b border-line">
                {group.label}
              </p>
              {group.items.map((t) => (
                <div key={t.id} className="flex justify-between items-center gap-4 px-5 py-4 border-b border-line last:border-0 hover:bg-canvas transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white"
                      style={{ background: colorOf[t.category] }}
                    >
                      {t.category.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 truncate flex items-center gap-1.5">
                        {t.category}
                        {t.recurringId && <Repeat size={13} className="shrink-0 text-ink-400" aria-label="Added automatically every month" />}
                      </p>
                      {t.note && <p className="text-sm text-ink-500 truncate">{t.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-sm font-semibold tabular-nums ${
                        t.type === "income" ? "text-gain bg-gain-soft" : "text-loss bg-loss-soft"
                      }`}
                    >
                      {t.type === "income" ? "+" : "−"}{formatINR(t.amount)}
                    </span>
                    <button onClick={() => handleEdit(t)} aria-label="Edit" className="text-ink-300 hover:text-brand-600 transition">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(t)} aria-label="Delete" className="text-ink-300 hover:text-loss transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </section>
    </main>
  );
}

export default Tracker;

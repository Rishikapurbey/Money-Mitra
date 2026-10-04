import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { formatINR, pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { isYearKey } from "../lib/yearReview";
import type { YearReview as Review } from "../lib/yearReview";
import Emphasised from "../components/Emphasised";

const COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-chart-${n})`);

function Card({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-ink-900">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-ink-900 tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-sm text-ink-500 truncate">{detail}</p>}
    </div>
  );
}

export default function YearReview() {
  const { year } = useParams();
  const wide = useWideLayout();
  const valid = isYearKey(year);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  useTitle(review ? `Your ${review.year} in money` : "Year in money");

  useEffect(() => {
    if (!valid) return;
    let current = true;
    api.get(`/recaps/year/${year}`, { params: { tzOffset: new Date().getTimezoneOffset() } }).then(
      (res) => {
        if (!current) return;
        setReview(res.data.review);
        setError("");
        setLoadedFor(year);
      },
      (err) => {
        if (!current) return;
        setReview(null);
        setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't load this year. Please try again.");
        setLoadedFor(year);
      }
    );
    return () => {
      current = false;
    };
  }, [year, valid]);

  const backLink = (
    <Link to="/tracker" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
      <ArrowLeft size={16} /> Tracker
    </Link>
  );

  if (!valid || error) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`}>
        {backLink}
        <section className="bg-surface border border-line rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-ink-900">Nothing to show here</h1>
          <p className="mt-2 text-sm text-ink-500">{valid ? error : "That doesn't look like a year we can show."}</p>
          <Link to="/tracker" className="mt-5 inline-block text-sm font-medium text-brand-600 hover:underline">
            Back to Tracker
          </Link>
        </section>
      </main>
    );
  }

  if (!review || loadedFor !== year) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`} aria-busy="true">
        {backLink}
        <div className="h-8 w-64 rounded-lg bg-ink-100 animate-pulse" />
        <div className="h-48 rounded-2xl bg-ink-100 animate-pulse" />
      </main>
    );
  }

  const { totals } = review;
  const previousYear = String(Number(review.year) - 1);
  const hasPrevious = review.firstYear !== null && previousYear >= review.firstYear;
  const navButton = "p-2.5 text-ink-500 hover:text-ink-900 transition";
  const disabledNav = "p-2.5 text-ink-200 cursor-not-allowed";

  const header = (
    <div className="space-y-4">
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Your {review.year} in money{review.inProgress && <span className="text-ink-500 font-normal"> so far</span>}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            From {review.transactionCount.toLocaleString("en-IN")} transaction{review.transactionCount === 1 ? "" : "s"}
            {review.inProgress && ". It fills in as the year goes on"}.
          </p>
        </div>
        <nav aria-label="Other years" className="flex items-center bg-surface border border-line rounded-xl">
          {hasPrevious ? (
            <Link to={`/tracker/year/${previousYear}`} aria-label="Previous year" className={navButton}>
              <ChevronLeft size={18} />
            </Link>
          ) : (
            <span aria-hidden="true" className={disabledNav}>
              <ChevronLeft size={18} />
            </span>
          )}
          <span className="w-20 text-center text-sm font-medium text-ink-900">{review.year}</span>
          {review.nextYear ? (
            <Link to={`/tracker/year/${review.nextYear}`} aria-label="Next year" className={navButton}>
              <ChevronRight size={18} />
            </Link>
          ) : (
            <span aria-hidden="true" className={disabledNav}>
              <ChevronRight size={18} />
            </span>
          )}
        </nav>
      </div>
    </div>
  );

  if (!review.enoughData) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`}>
        {header}
        <section className="bg-surface border border-line rounded-2xl p-8 text-center">
          <h2 className="font-semibold text-ink-900">Not enough yet for {review.year}</h2>
          <p className="mt-2 text-sm text-ink-500 max-w-md mx-auto">
            A year in review needs at least 10 transactions. Keep adding them in Tracker, or import a bank statement to fill in the gaps.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm font-medium">
            <Link to="/tracker" className="text-brand-600 hover:underline">
              Go to Tracker
            </Link>
            <Link to="/tracker/import" className="text-brand-600 hover:underline">
              Import transactions
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const headline = (
    <section className="dark-panel bg-ink-900 rounded-2xl p-6 sm:p-8 text-white lg:flex lg:items-end lg:justify-between lg:gap-10">
      <div>
        <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">
          {totals.saved >= 0 ? `Saved in ${review.year}` : `Overspent in ${review.year}`}
          {review.inProgress && " so far"}
        </p>
        <p className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums">{formatINR(Math.abs(totals.saved))}</p>
        {totals.savingsRate !== null && totals.saved >= 0 && <p className="mt-2 text-sm text-ink-300">{totals.savingsRate}% of your income</p>}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-ink-800 pt-5 lg:mt-0 lg:shrink-0 lg:gap-10 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-10">
        <div>
          <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">Money in</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatINR(totals.income)}</p>
        </div>
        <div>
          <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">Money out</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatINR(totals.expense)}</p>
        </div>
      </div>
    </section>
  );

  const highlights = review.highlights.length > 0 && (
    <Card title="Your year in a few lines">
      <ul className="space-y-3 text-sm text-ink-700 leading-relaxed">
        {review.highlights.map((h) => (
          <li key={h} className="flex gap-3">
            <Sparkles size={16} className="shrink-0 mt-0.5 text-brand-600" aria-hidden="true" />
            <p>
              <Emphasised text={h} />
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );

  const legend = (
    <div className="flex items-center gap-4 text-sm text-ink-500">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-chart-1" /> Income
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-chart-2" /> Expense
      </span>
    </div>
  );

  const monthsCard = (
    <Card title="Month by month" aside={legend}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={review.months} barGap={4} margin={{ left: 0, right: 0 }}>
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
      {(review.bestMonth || review.toughestMonth) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 border-t border-line pt-4 text-sm">
          {review.bestMonth && (
            <Link to={`/tracker/recap/${review.bestMonth.month}`} className="rounded-xl border border-line p-3 hover:border-brand-500 transition">
              <span className="block text-xs font-medium uppercase tracking-wider text-ink-500">Best month</span>
              <span className="block mt-1 font-medium text-ink-900">{review.bestMonth.name}</span>
              <span className="block text-ink-500">Saved {formatINR(review.bestMonth.saved)}</span>
            </Link>
          )}
          {review.toughestMonth && (
            <Link to={`/tracker/recap/${review.toughestMonth.month}`} className="rounded-xl border border-line p-3 hover:border-brand-500 transition">
              <span className="block text-xs font-medium uppercase tracking-wider text-ink-500">Toughest month</span>
              <span className="block mt-1 font-medium text-ink-900">{review.toughestMonth.name}</span>
              <span className="block text-ink-500">
                {review.toughestMonth.saved >= 0 ? `Saved ${formatINR(review.toughestMonth.saved)}` : `Overspent ${formatINR(-review.toughestMonth.saved)}`}
              </span>
            </Link>
          )}
        </div>
      )}
    </Card>
  );

  const categories = (
    <Card title="Where your money went">
      {review.categories.length === 0 ? (
        <p className="text-sm text-ink-500">No spending recorded.</p>
      ) : (
        <ul className="space-y-4">
          {review.categories.map((c, i) => (
            <li key={c.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink-900 truncate">{c.name}</span>
                <span className="shrink-0 tabular-nums text-ink-900">
                  {formatINR(c.amount)} <span className="text-ink-500">· {c.share}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-ink-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(c.share, 2)}%`, background: COLORS[i % COLORS.length] }} />
              </div>
              <p className="mt-1 text-xs text-ink-500">About {formatINR(c.perMonth)} a month</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const budgets = review.budgets.some((b) => b.monthsCounted > 0) && (
    <Card title="Budgets">
      <ul className="space-y-3">
        {review.budgets
          .filter((b) => b.monthsCounted > 0)
          .map((b) => (
            <li key={b.category} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink-900 truncate">
                {b.category} <span className="font-normal text-ink-500">· {formatINR(b.limit)} a month</span>
              </span>
              <span className={`shrink-0 tabular-nums ${b.monthsWithin === b.monthsCounted ? "text-gain font-medium" : "text-ink-700"}`}>
                {b.monthsWithin} of {b.monthsCounted} months within
              </span>
            </li>
          ))}
      </ul>
      <p className="mt-4 text-xs text-ink-500">
        Finished months only, measured against your budgets as they are today.
      </p>
    </Card>
  );

  const goals = review.goals.length > 0 && (
    <Card title="Your goals">
      {review.goalsAdded > 0 && (
        <p className="mb-4 text-sm text-ink-700">
          You put <span className="font-semibold text-ink-900">{formatINR(review.goalsAdded)}</span> towards your goals in {review.year}.
        </p>
      )}
      <ul className="space-y-3">
        {review.goals.map((g) => (
          <li key={g.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink-900 truncate">{g.name}</span>
              <span className="shrink-0 tabular-nums text-ink-700">
                {formatINR(g.savedAmount)} <span className="text-ink-500">of {formatINR(g.targetAmount)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-ink-100 overflow-hidden">
              <div className={`h-full rounded-full ${g.pct >= 100 ? "bg-gain" : "bg-brand-500"}`} style={{ width: `${g.pct}%` }} />
            </div>
            {g.added !== 0 && (
              <p className={`mt-1 text-xs ${g.added > 0 ? "text-gain" : "text-ink-500"}`}>
                {g.added > 0 ? "+" : "−"}
                {formatINR(Math.abs(g.added))} in {review.year}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );

  const stats = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat
        label="Biggest expense"
        value={review.biggestExpense ? formatINR(review.biggestExpense.amount) : "None"}
        detail={
          review.biggestExpense
            ? `${review.biggestExpense.note || review.biggestExpense.category} · ${new Date(review.biggestExpense.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
            : undefined
        }
      />
      <Stat label="Days without spending" value={`${review.noSpendDays} of ${review.daysCounted}`} />
      <Stat label="Average spend a month" value={formatINR(Math.round(totals.expense / Math.max(1, review.months.length)))} />
      <Stat label="Transactions" value={review.transactionCount.toLocaleString("en-IN")} />
    </div>
  );

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      {header}
      {headline}
      {stats}
      {wide ? (
        <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            {monthsCard}
            {categories}
          </div>
          <div className="space-y-6">
            {highlights}
            {budgets}
            {goals}
          </div>
        </div>
      ) : (
        <>
          {highlights}
          {monthsCard}
          <div className="grid gap-6 md:grid-cols-2 items-start">
            {categories}
            <div className="space-y-6">
              {budgets}
              {goals}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

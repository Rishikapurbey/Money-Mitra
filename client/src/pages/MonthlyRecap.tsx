import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { formatINR, pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { termBySlug } from "../lib/learn";
import { isMonthKey, percentChange, shiftMonth } from "../lib/recap";
import { signedINR, worthINR } from "../lib/networth";
import type { Recap } from "../lib/recap";
import Emphasised from "../components/Emphasised";

const COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-chart-${n})`);

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <h2 className="font-semibold text-ink-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// "12% more than August", in a colour that says whether that's good for this kind of number
function Change({ now, before, month, moreIsGood }: { now: number; before: number; month: string; moreIsGood: boolean }) {
  const pct = percentChange(now, before);
  if (pct === null || pct === 0) return null;
  const good = pct > 0 === moreIsGood;
  return (
    <p className={`mt-1 text-xs ${good ? "text-brand-300" : "text-ink-300"}`}>
      {Math.abs(pct)}% {pct > 0 ? "more" : "less"} than {month}
    </p>
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

export default function MonthlyRecap() {
  const { month } = useParams();
  const wide = useWideLayout();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const valid = isMonthKey(month);
  useTitle(recap ? `${recap.monthName} recap` : "Monthly recap");

  useEffect(() => {
    if (!valid) return;
    let current = true;
    api.get(`/recaps/${month}`, { params: { tzOffset: new Date().getTimezoneOffset() } }).then(
      (res) => {
        if (!current) return;
        setRecap(res.data.recap);
        setError("");
        setLoadedFor(month);
      },
      (err) => {
        if (!current) return;
        setRecap(null);
        setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't load this recap. Please try again.");
        setLoadedFor(month);
      }
    );
    return () => {
      current = false;
    };
  }, [month, valid]);

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
          <h1 className="text-xl font-semibold text-ink-900">No recap here</h1>
          <p className="mt-2 text-sm text-ink-500">{valid ? error : "That doesn't look like a month we can show."}</p>
          <Link to="/tracker" className="mt-5 inline-block text-sm font-medium text-brand-600 hover:underline">
            Back to Tracker
          </Link>
        </section>
      </main>
    );
  }

  if (!recap || loadedFor !== month) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`} aria-busy="true">
        {backLink}
        <div className="h-8 w-64 rounded-lg bg-ink-100 animate-pulse" />
        <div className="h-48 rounded-2xl bg-ink-100 animate-pulse" />
      </main>
    );
  }

  const { totals, previous } = recap;
  const previousMonth = shiftMonth(recap.month, -1);
  const hasPrevious = recap.firstMonth !== null && previousMonth >= recap.firstMonth;
  const learn = termBySlug(recap.learnSlug);
  const shortMonth = recap.monthName.split(" ")[0];
  const navButton = "p-2.5 text-ink-500 hover:text-ink-900 transition";
  const disabledNav = "p-2.5 text-ink-200 cursor-not-allowed";

  const header = (
    <div className="space-y-4">
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{recap.monthName} recap</h1>
          <p className="mt-1 text-sm text-ink-500">
            How your month went, from {recap.transactionCount} transaction{recap.transactionCount === 1 ? "" : "s"}.{" "}
            <Link to={`/tracker/year/${recap.month.slice(0, 4)}`} className="font-medium text-brand-600 hover:underline">
              See your {recap.month.slice(0, 4)}
            </Link>
          </p>
        </div>
        <nav aria-label="Other months" className="flex items-center bg-surface border border-line rounded-xl">
          {hasPrevious ? (
            <Link to={`/tracker/recap/${previousMonth}`} aria-label="Previous month" className={navButton}>
              <ChevronLeft size={18} />
            </Link>
          ) : (
            <span aria-hidden="true" className={disabledNav}>
              <ChevronLeft size={18} />
            </span>
          )}
          <span className="w-36 text-center text-sm font-medium text-ink-900">{recap.monthName}</span>
          {recap.nextMonth ? (
            <Link to={`/tracker/recap/${recap.nextMonth}`} aria-label="Next month" className={navButton}>
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

  if (!recap.enoughData) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`}>
        {header}
        <section className="bg-surface border border-line rounded-2xl p-8 text-center">
          <h2 className="font-semibold text-ink-900">Not much to recap for {shortMonth}</h2>
          <p className="mt-2 text-sm text-ink-500 max-w-md mx-auto">
            A recap needs at least a few transactions. Add the ones you remember in Tracker, or import a bank statement.
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
          {totals.saved >= 0 ? `Saved in ${shortMonth}` : `Overspent in ${shortMonth}`}
        </p>
        <p className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums">{formatINR(Math.abs(totals.saved))}</p>
        {totals.savingsRate !== null && totals.saved >= 0 && (
          <p className="mt-2 text-sm text-ink-300">
            {totals.savingsRate}% of your income
            {previous?.savingsRate != null && previous.savingsRate !== totals.savingsRate &&
              `, ${totals.savingsRate > previous.savingsRate ? "up" : "down"} from ${previous.savingsRate}% in ${recap.previousMonthName}`}
          </p>
        )}
        {recap.netWorth && (
          <Link to="/tracker/net-worth" className="mt-1 block text-sm text-ink-300 hover:text-white transition">
            Net worth {worthINR(recap.netWorth.end)}, {signedINR(recap.netWorth.change)} in {shortMonth}
          </Link>
        )}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-ink-800 pt-5 lg:mt-0 lg:shrink-0 lg:gap-10 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-10">
        <div>
          <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">Money in</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatINR(totals.income)}</p>
          {previous && <Change now={totals.income} before={previous.income} month={recap.previousMonthName} moreIsGood />}
        </div>
        <div>
          <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">Money out</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatINR(totals.expense)}</p>
          {previous && <Change now={totals.expense} before={previous.expense} month={recap.previousMonthName} moreIsGood={false} />}
        </div>
      </div>
    </section>
  );

  const categories = (
    <Card title="Where your money went">
      {recap.categories.length === 0 ? (
        <p className="text-sm text-ink-500">No spending this month.</p>
      ) : (
        <ul className="space-y-4">
          {recap.categories.map((c, i) => (
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
              {c.changePct !== null && c.changePct !== 0 && (
                <p className="mt-1 text-xs text-ink-500">
                  {Math.abs(c.changePct)}% {c.changePct > 0 ? "more" : "less"} than {recap.previousMonthName} ({formatINR(c.previous)})
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const takeaways = (
    <Card title="In short">
      <ul className="space-y-4 text-sm text-ink-700 leading-relaxed">
        {recap.wentWell && (
          <li className="flex gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-gain" aria-hidden="true" />
            <p>
              <span className="sr-only">Went well: </span>
              <Emphasised text={recap.wentWell} />
            </p>
          </li>
        )}
        {recap.toWatch && (
          <li className="flex gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-warn" aria-hidden="true" />
            <p>
              <span className="sr-only">To watch: </span>
              <Emphasised text={recap.toWatch} />
            </p>
          </li>
        )}
        {recap.bills && (
          <li className="flex gap-3">
            {recap.bills.onTime === recap.bills.total ? (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-gain" aria-hidden="true" />
            ) : (
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-warn" aria-hidden="true" />
            )}
            <p>
              {recap.bills.onTime === recap.bills.total ? (
                <>
                  You paid <strong className="font-semibold text-ink-900">every bill on time</strong>
                  {recap.bills.total > 1 && ` (${recap.bills.total} of them)`}.
                </>
              ) : (
                <>
                  You paid <strong className="font-semibold text-ink-900">{recap.bills.onTime} of {recap.bills.total} bills</strong> on time.
                </>
              )}
            </p>
          </li>
        )}
        {!recap.wentWell && !recap.toWatch && !recap.bills && <li>A steady month, without big changes from {recap.previousMonthName}.</li>}
      </ul>
      {learn && (
        <Link
          to={`/learn/${learn.slug}`}
          className="mt-5 flex items-start gap-3 rounded-xl border border-line p-4 hover:border-brand-500 transition"
        >
          <BookOpen size={18} className="shrink-0 mt-0.5 text-brand-600" />
          <span>
            <span className="block text-sm font-medium text-ink-900">Worth a read: {learn.term}</span>
            <span className="block text-sm text-ink-500">{learn.short}</span>
          </span>
        </Link>
      )}
    </Card>
  );

  const kept = recap.budgets.filter((b) => !b.over).length;
  const budgets = (
    <Card title="Budgets">
      {recap.budgets.length === 0 ? (
        <p className="text-sm text-ink-500">
          You haven't set any budgets. <Link to="/tracker" className="font-medium text-brand-600 hover:underline">Add one in Tracker</Link> to
          see how each month measures up.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-700">
            You stayed within <span className="font-semibold text-ink-900">{kept} of {recap.budgets.length}</span>{" "}
            budget{recap.budgets.length === 1 ? "" : "s"}.
          </p>
          <ul className="mt-4 space-y-3">
            {recap.budgets.map((b) => (
              <li key={b.category}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink-900 truncate">{b.category}</span>
                  <span className={`shrink-0 tabular-nums ${b.over ? "text-loss font-medium" : "text-ink-700"}`}>
                    {formatINR(b.spent)} <span className="text-ink-500 font-normal">of {formatINR(b.limit)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${b.over ? "bg-loss" : "bg-brand-500"}`}
                    style={{ width: `${Math.min((b.spent / b.limit) * 100, 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-500">Measured against your budgets as they are today.</p>
        </>
      )}
    </Card>
  );

  const goals = recap.goals.length > 0 && (
    <Card title="Your goals">
      {recap.goalsAdded !== 0 && (
        <p className="mb-4 text-sm text-ink-700">
          {recap.goalsAdded > 0 ? (
            <>
              You put <span className="font-semibold text-ink-900">{formatINR(recap.goalsAdded)}</span> towards your goals in {shortMonth}.
            </>
          ) : (
            <>
              You took <span className="font-semibold text-ink-900">{formatINR(-recap.goalsAdded)}</span> out of your goals in {shortMonth}.
            </>
          )}
        </p>
      )}
      <ul className="space-y-3">
        {recap.goals.map((g) => (
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
                {formatINR(Math.abs(g.added))} in {shortMonth}
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
        value={recap.biggestExpense ? formatINR(recap.biggestExpense.amount) : "None"}
        detail={
          recap.biggestExpense
            ? `${recap.biggestExpense.note || recap.biggestExpense.category} · ${shortDate(recap.biggestExpense.date)}`
            : undefined
        }
      />
      <Stat label="Days without spending" value={`${recap.noSpendDays} of ${recap.daysInMonth}`} />
      <Stat
        label="Recurring payments"
        value={recap.recurringTotal > 0 ? formatINR(recap.recurringTotal) : "None"}
        detail={recap.recurringTotal > 0 ? "Added for you each month" : undefined}
      />
      <Stat label="Transactions" value={String(recap.transactionCount)} />
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
            {categories}
            {budgets}
          </div>
          <div className="space-y-6">
            {takeaways}
            {goals}
          </div>
        </div>
      ) : (
        <>
          {takeaways}
          <div className="grid gap-6 md:grid-cols-2 items-start">
            {categories}
            {budgets}
          </div>
          {goals}
        </>
      )}
    </main>
  );
}

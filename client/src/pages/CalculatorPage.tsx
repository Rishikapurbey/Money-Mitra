import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Calculator as CalculatorIcon, CheckCircle2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../lib/api";
import { CALCULATORS, calculatorBySlug, emergencyFund, emi, fd, inflation, sip } from "../lib/calculators";
import { CALCULATOR_ICONS } from "../lib/calculatorIcons";
import { useWideLayout } from "../lib/useMediaQuery";
import { termBySlug } from "../lib/learn";
import { formatINR, pageWidth } from "../lib/ui";
import { useTitle } from "../lib/useTitle";

const rupees = (n: number) => formatINR(Math.round(n));
const compactRupees = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { notation: "compact" });

interface FieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
}

// A slider with a number box beside it; typing is free, and the value is kept in range on blur
function Field({ label, value, onChange, min, max, step, prefix, suffix }: FieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-ink-700">{label}</label>
        <div className="flex items-center gap-1 bg-canvas border border-line rounded-lg px-2.5 py-1 focus-within:border-brand-500">
          {prefix && <span className="text-sm text-ink-500">{prefix}</span>}
          <input
            type="number"
            inputMode="decimal"
            value={draft ?? String(value)}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
            }}
            onBlur={() => {
              const n = parseFloat(draft ?? "");
              if (draft !== null) onChange(Number.isFinite(n) ? clamp(n) : value);
              setDraft(null);
            }}
            aria-label={label}
            className="w-24 bg-transparent text-right text-sm font-semibold text-ink-900 tabular-nums outline-none"
          />
          {suffix && <span className="text-sm text-ink-500">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={`${label} slider`}
        className="mt-3 w-full accent-brand-600"
      />
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? "text-3xl font-semibold text-ink-900" : "text-lg font-semibold text-ink-700"}`}>
        {value}
      </p>
    </div>
  );
}

function Split({ parts }: { parts: { name: string; value: number; color: string }[] }) {
  return (
    <div className="flex items-center gap-6">
      <div className="w-36 h-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={parts} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2} stroke="none">
              {parts.map((p) => (
                <Cell key={p.name} fill={p.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => rupees(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-ink-700">{p.name}</span>
            <span className="font-medium text-ink-900 tabular-nums">{rupees(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Layout {
  inputs: ReactNode;
  results: ReactNode;
  howItWorks: string;
}

function useSipCalculator(): Layout {
  const [monthly, setMonthly] = useState(5000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const r = sip(monthly, rate, years);
  return {
    inputs: (
      <>
        <Field label="Monthly investment" value={monthly} onChange={setMonthly} min={500} max={100000} step={500} prefix="₹" />
        <Field label="Expected return (yearly)" value={rate} onChange={setRate} min={1} max={30} step={0.5} suffix="%" />
        <Field label="Time period" value={years} onChange={setYears} min={1} max={40} step={1} suffix="years" />
      </>
    ),
    results: (
      <>
        <Stat label="Estimated value" value={rupees(r.value)} strong />
        <div className="grid grid-cols-2 gap-4">
          <Stat label="You invest" value={rupees(r.invested)} />
          <Stat label="Estimated gains" value={rupees(r.gains)} />
        </div>
        <div className="h-52 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={r.series} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-500)", fontSize: 12 }} tickFormatter={(y) => `${y}y`} />
              <YAxis width={60} tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-500)", fontSize: 12 }} tickFormatter={compactRupees} />
              <Tooltip formatter={(v) => rupees(Number(v))} labelFormatter={(y) => `Year ${y}`} />
              <Area type="monotone" dataKey="value" name="Estimated value" stroke="var(--color-chart-1)" fill="var(--color-brand-100)" strokeWidth={2} />
              <Area type="monotone" dataKey="invested" name="Invested" stroke="var(--color-chart-2)" fill="var(--color-ink-100)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </>
    ),
    howItWorks:
      "Each monthly instalment is invested at the start of the month and grows at the expected yearly return, compounded monthly. Real mutual fund returns go up and down; this shows what a steady average would give.",
  };
}

function useEmiCalculator(): Layout {
  const [principal, setPrincipal] = useState(500000);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(5);
  const r = emi(principal, rate, years);
  return {
    inputs: (
      <>
        <Field label="Loan amount" value={principal} onChange={setPrincipal} min={10000} max={10000000} step={10000} prefix="₹" />
        <Field label="Interest rate (yearly)" value={rate} onChange={setRate} min={1} max={30} step={0.1} suffix="%" />
        <Field label="Loan tenure" value={years} onChange={setYears} min={1} max={30} step={1} suffix="years" />
      </>
    ),
    results: (
      <>
        <Stat label="Monthly EMI" value={rupees(r.monthly)} strong />
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total interest" value={rupees(r.interest)} />
          <Stat label="Total amount paid" value={rupees(r.totalPaid)} />
        </div>
        <Split
          parts={[
            { name: "Principal", value: principal, color: "var(--color-chart-2)" },
            { name: "Interest", value: r.interest, color: "var(--color-chart-1)" },
          ]}
        />
      </>
    ),
    howItWorks:
      "The EMI is the fixed monthly payment that repays the loan and its interest over the tenure, with interest charged on the remaining balance each month. A longer tenure lowers the EMI but raises the total interest.",
  };
}

function useFdCalculator(): Layout {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(3);
  const r = fd(principal, rate, years);
  return {
    inputs: (
      <>
        <Field label="Deposit amount" value={principal} onChange={setPrincipal} min={1000} max={10000000} step={1000} prefix="₹" />
        <Field label="Interest rate (yearly)" value={rate} onChange={setRate} min={1} max={15} step={0.1} suffix="%" />
        <Field label="Time period" value={years} onChange={setYears} min={1} max={10} step={1} suffix="years" />
      </>
    ),
    results: (
      <>
        <Stat label="Maturity value" value={rupees(r.maturity)} strong />
        <div className="grid grid-cols-2 gap-4">
          <Stat label="You deposit" value={rupees(principal)} />
          <Stat label="Interest earned" value={rupees(r.interest)} />
        </div>
        <Split
          parts={[
            { name: "Deposit", value: principal, color: "var(--color-chart-2)" },
            { name: "Interest", value: r.interest, color: "var(--color-chart-1)" },
          ]}
        />
      </>
    ),
    howItWorks:
      "Interest is compounded every quarter, as most Indian banks do. Interest is taxed at your income tax slab rate, and banks may deduct TDS, so the amount you keep can be lower.",
  };
}

function useInflationCalculator(): Layout {
  const [amount, setAmount] = useState(10000);
  const [rate, setRate] = useState(6);
  const [years, setYears] = useState(10);
  const r = inflation(amount, rate, years);
  return {
    inputs: (
      <>
        <Field label="Cost today" value={amount} onChange={setAmount} min={100} max={10000000} step={100} prefix="₹" />
        <Field label="Inflation (yearly)" value={rate} onChange={setRate} min={1} max={15} step={0.5} suffix="%" />
        <Field label="Years from now" value={years} onChange={setYears} min={1} max={40} step={1} suffix="years" />
      </>
    ),
    results: (
      <>
        <Stat label={`The same thing in ${years} years could cost`} value={rupees(r.future)} strong />
        <p className="text-sm text-ink-700 leading-relaxed">
          Put the other way: {rupees(amount)} kept as cash for {years} years would only buy what about{" "}
          <span className="font-semibold text-ink-900">{rupees(r.purchasingPower)}</span> buys today.
        </p>
      </>
    ),
    howItWorks:
      "Prices are assumed to rise by the same percentage every year. Real inflation changes from year to year and differs between things like food, education and healthcare.",
  };
}

function useEmergencyFundCalculator(): Layout {
  const [monthly, setMonthly] = useState(30000);
  const [months, setMonths] = useState(6);
  const [saved, setSaved] = useState(50000);
  const [goalState, setGoalState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const r = emergencyFund(monthly, months, saved);
  const signedIn = Boolean(localStorage.getItem("token"));

  const createGoal = async () => {
    setGoalState("saving");
    try {
      const res = await api.post("/goals", { name: "Emergency fund", targetAmount: Math.round(r.target) });
      if (saved > 0) await api.post(`/goals/${res.data.goal.id}/contributions`, { amount: saved });
      setGoalState("done");
    } catch {
      setGoalState("error");
    }
  };

  return {
    inputs: (
      <>
        <Field label="Essential monthly expenses" value={monthly} onChange={setMonthly} min={1000} max={500000} step={1000} prefix="₹" />
        <Field label="Months of cover" value={months} onChange={setMonths} min={3} max={12} step={1} suffix="months" />
        <Field label="Already saved" value={saved} onChange={setSaved} min={0} max={5000000} step={1000} prefix="₹" />
      </>
    ),
    results: (
      <>
        <Stat label="Your emergency fund target" value={rupees(r.target)} strong />
        <div>
          <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${r.progress * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-700">
            {r.gap === 0 ? (
              <span className="font-medium text-gain">You've already reached this target.</span>
            ) : (
              <>
                You have <span className="font-semibold text-ink-900">{Math.round(r.progress * 100)}%</span>.{" "}
                <span className="font-semibold text-ink-900">{rupees(r.gap)}</span> more to go.
              </>
            )}
          </p>
        </div>
        {r.gap > 0 &&
          (signedIn ? (
            goalState === "done" ? (
              <p className="flex items-center gap-2 text-sm text-gain font-medium">
                <CheckCircle2 size={16} /> Goal created.{" "}
                <Link to="/tracker#goals" className="underline underline-offset-2">
                  See it in your tracker
                </Link>
              </p>
            ) : (
              <div>
                <button
                  onClick={createGoal}
                  disabled={goalState === "saving"}
                  className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60"
                >
                  {goalState === "saving" ? "Creating…" : "Create this as a savings goal"}
                </button>
                {goalState === "error" && (
                  <p className="mt-2 text-sm text-loss">We couldn't create the goal. Please try again.</p>
                )}
              </div>
            )
          ) : (
            <Link to="/signup" className="inline-block bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition">
              Sign up free to track this goal
            </Link>
          ))}
      </>
    ),
    howItWorks:
      "The target is your essential monthly expenses (rent, food, bills, EMIs) multiplied by the months of cover you want. Three to six months is a common guideline; choose more if your income is irregular or you support a family.",
  };
}

const CALCULATORS_BY_SLUG: Record<string, () => Layout> = {
  sip: useSipCalculator,
  emi: useEmiCalculator,
  fd: useFdCalculator,
  inflation: useInflationCalculator,
  "emergency-fund": useEmergencyFundCalculator,
};

interface PageParts {
  wide: boolean;
  backLink: ReactNode;
  intro: ReactNode;
  learnCard: ReactNode;
  otherCalculators: ReactNode;
  disclaimer: ReactNode;
}

// Separate component so each calculator's hooks always run in the same order
function CalculatorBody({ useCalculator, wide, backLink, intro, learnCard, otherCalculators, disclaimer }: PageParts & { useCalculator: () => Layout }) {
  const { inputs, results, howItWorks } = useCalculator();

  const workArea = (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="lg:col-span-2 bg-surface border border-line rounded-2xl p-6 space-y-6">{inputs}</section>
      <section className="lg:col-span-3 bg-surface border border-line rounded-2xl p-6 space-y-5">{results}</section>
    </div>
  );

  const howCard = (
    <section className="bg-canvas border border-line rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-ink-900">How this is calculated</h2>
      <p className="mt-2 text-sm text-ink-700 leading-relaxed">{howItWorks}</p>
    </section>
  );

  // Wide screens: inputs and results keep a compact width, with the explanation and next steps beside them
  if (wide) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
        <div className="space-y-6 min-w-0">
          {backLink}
          {intro}
          {workArea}
          {disclaimer}
        </div>
        <aside className="space-y-6 sticky top-20" aria-label="About this calculator">
          {howCard}
          {learnCard}
          {otherCalculators}
        </aside>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {backLink}
      {intro}
      {workArea}
      {howCard}
      {learnCard}
      {disclaimer}
    </div>
  );
}

function CalculatorPage() {
  const { slug } = useParams();
  const info = slug ? calculatorBySlug(slug) : undefined;
  const wide = useWideLayout();
  useTitle(info?.name ?? "Calculators");
  const useCalculator = slug ? CALCULATORS_BY_SLUG[slug] : undefined;

  const backLink = (
    <Link to="/calculators" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
      <ArrowLeft size={16} /> All calculators
    </Link>
  );

  if (!info || !useCalculator) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`}>
        {backLink}
        <div className="bg-surface border border-line rounded-2xl px-5 py-14 text-center">
          <p className="font-medium text-ink-900">We couldn't find that calculator</p>
        </div>
      </main>
    );
  }

  const learn = termBySlug(info.learnSlug);

  const intro = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{info.name}</h1>
      <p className="mt-1 text-sm text-ink-500">{info.short}</p>
    </div>
  );

  const learnCard = learn && (
    <Link
      to={`/learn/${learn.slug}`}
      className="flex items-center gap-3 bg-brand-50 rounded-2xl p-5 text-brand-700 hover:bg-brand-100 transition"
    >
      <BookOpen size={20} className="shrink-0" />
      <span>
        <span className="block font-semibold">New to this? Read: {learn.term}</span>
        <span className="block text-sm text-ink-700">{learn.short}</span>
      </span>
    </Link>
  );

  const otherCalculators = (
    <section className="bg-surface border border-line rounded-2xl p-5" aria-labelledby="other-calculators-title">
      <h2 id="other-calculators-title" className="font-semibold text-ink-900">Other calculators</h2>
      <ul className="mt-3 space-y-1">
        {CALCULATORS.filter((c) => c.slug !== info.slug).map((c) => {
          const Icon = CALCULATOR_ICONS[c.slug] ?? CalculatorIcon;
          return (
            <li key={c.slug}>
              <Link to={`/calculators/${c.slug}`} className="flex items-center gap-3 py-1.5 group">
                <Icon size={16} className="shrink-0 text-ink-400 group-hover:text-brand-600 transition" />
                <span className="text-sm font-medium text-ink-900 group-hover:text-brand-700 transition">{c.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const disclaimer = (
    <p className="text-xs text-ink-400 text-center">
      Results are estimates for planning only. They are not guaranteed returns or financial advice.
    </p>
  );

  return (
    <main className={`${pageWidth} py-8`}>
      <CalculatorBody
        key={info.slug}
        useCalculator={useCalculator}
        wide={wide}
        backLink={backLink}
        intro={intro}
        learnCard={learnCard}
        otherCalculators={otherCalculators}
        disclaimer={disclaimer}
      />
    </main>
  );
}

export default CalculatorPage;

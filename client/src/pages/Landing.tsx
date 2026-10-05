import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Landmark,
  Receipt,
  Upload,
  UsersRound,
  Check,
  EyeOff,
  IndianRupee,
  MessageCircle,
  MessagesSquare,
  PieChart,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet2,
  Download,
} from "lucide-react";
import type { ReactNode } from "react";
import { termBySlug } from "../lib/learn";
import { useInstallPrompt } from "../lib/installPrompt";
import { CALCULATORS } from "../lib/calculators";
import { CALCULATOR_ICONS } from "../lib/calculatorIcons";
import { useTitle } from "../lib/useTitle";
import { faqs } from "../lib/faqs";

// Illustrative figures for the product previews; not real user data
function MiniBalance() {
  return (
    <div className="dark-panel bg-ink-900 rounded-2xl p-5 text-white shadow-xl shadow-ink-900/10">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-300">
        <Wallet2 size={12} /> Balance
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">₹48,250</p>
      <p className="mt-3 text-xs text-ink-300">You saved 32% of your income in September</p>
      <div className="mt-1.5 h-1.5 rounded-full bg-ink-800 overflow-hidden">
        <div className="h-full w-[32%] rounded-full bg-brand-300" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-800 pt-3 text-sm">
        <div>
          <p className="text-[11px] text-ink-300">Income</p>
          <p className="font-semibold tabular-nums">₹72,000</p>
        </div>
        <div>
          <p className="text-[11px] text-ink-300">Expense</p>
          <p className="font-semibold tabular-nums">₹48,960</p>
        </div>
      </div>
    </div>
  );
}

function MiniBudgets() {
  const rows = [
    { name: "Food", spent: "₹5,200", of: "₹8,000", pct: 65, color: "bg-brand-500", note: "₹2,800 left" },
    { name: "Shopping", spent: "₹4,600", of: "₹5,000", pct: 92, color: "bg-warn", note: "₹400 left, getting close" },
  ];
  return (
    <div className="bg-surface border border-line rounded-2xl p-5 shadow-lg shadow-ink-900/5">
      <p className="text-sm font-semibold text-ink-900">Budgets</p>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex justify-between text-xs">
              <span className="font-medium text-ink-900">{r.name}</span>
              <span className="text-ink-500 tabular-nums">
                <span className="text-ink-900 font-medium">{r.spent}</span> of {r.of}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
            </div>
            <p className={`mt-1 text-[11px] ${r.pct >= 80 ? "text-warn" : "text-ink-500"}`}>{r.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniGoal() {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5 shadow-lg shadow-ink-900/5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-ink-900">Emergency fund</span>
        <span className="text-ink-500 tabular-nums">
          <span className="text-ink-900 font-medium">₹1,08,000</span> of ₹1,80,000
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full w-[60%] rounded-full bg-brand-500" />
      </div>
      <p className="mt-1 text-[11px] text-ink-500">Save about ₹12,000 a month to reach it by Mar 2027</p>
    </div>
  );
}

function MiniQuestion() {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5 shadow-lg shadow-ink-900/5">
      <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">Investing</span>
      <p className="mt-2 text-sm font-semibold text-ink-900">Is an SIP better than an FD if I need the money in 2 years?</p>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-500">
        <span className="font-medium text-ink-700">Anonymous</span>
        <span>2h ago</span>
        <span className="ml-auto flex items-center gap-1">
          <MessageCircle size={12} /> 4 replies
        </span>
      </div>
    </div>
  );
}

function MiniTerm() {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5 shadow-lg shadow-ink-900/5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Basics · Saving</p>
      <p className="mt-1 text-base font-semibold text-ink-900">Compound interest</p>
      <p className="mt-1 text-xs text-ink-700">Earning interest on your interest, so money grows faster over time.</p>
      <p className="mt-3 text-[11px] text-ink-500 bg-canvas rounded-lg p-2.5">
        ₹10,000 at 8% grows to about ₹21,589 in 10 years.
      </p>
    </div>
  );
}

interface Feature {
  icon: typeof PieChart;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
}

// Smaller features, listed after the four main ones
const extras = [
  { icon: UsersRound, title: "Shared expenses", body: "Split trips and flat costs with friends, see who owes whom, and settle up." },
  { icon: Landmark, title: "Net worth", body: "Everything you own minus what you owe, with your bank balance kept up to date by your Tracker." },
  { icon: Receipt, title: "Bill reminders", body: "A nudge two days before rent, EMIs and bills are due, and on the day." },
  { icon: CalendarCheck, title: "Monthly recap", body: "A short look back at each month: where it went and what changed." },
  { icon: Upload, title: "Bank statement import", body: "Bring in past months from a CSV file instead of typing them in." },
];

const features: Feature[] = [
  {
    icon: PieChart,
    eyebrow: "Track",
    title: "See where your money actually goes",
    body: "Log income and expenses in seconds, then see each month clearly: what came in, what went out, and how much you kept.",
    points: ["Month-by-month view with your savings rate", "Spending by category at a glance", "A six-month trend to see if you're improving"],
    visual: <MiniBalance />,
  },
  {
    icon: Target,
    eyebrow: "Plan",
    title: "Budgets and goals that keep you on track",
    body: "Set a monthly limit for the categories that tend to run away, and save towards what matters, one step at a time.",
    points: ["Gentle warnings before you overspend", "Goals that tell you how much to save each month", "Progress you can actually see"],
    visual: (
      <div className="space-y-4">
        <MiniBudgets />
        <MiniGoal />
      </div>
    ),
  },
  {
    icon: BookOpen,
    eyebrow: "Learn",
    title: "Money terms, finally explained simply",
    body: "SIP, NAV, CIBIL, 80C. Every term is explained in plain English with a worked example in rupees, from the basics to advanced.",
    points: ["Basics, intermediate and advanced levels", "Real rupee examples, calculated exactly", "Free to read, no account needed"],
    visual: <MiniTerm />,
  },
  {
    icon: MessagesSquare,
    eyebrow: "Discuss",
    title: "Ask anything. There are no dumb questions.",
    body: "Everyone starts somewhere. Ask the community about loans, tax, saving or investing, and post anonymously whenever you prefer.",
    points: ["Post or reply anonymously", "Topics from budgeting to tax", "A friendly place to learn from others"],
    visual: <MiniQuestion />,
  },
];

const promises = [
  {
    icon: Sparkles,
    title: "Plain English, no jargon",
    body: "Written for people who were never taught this at school or at home.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "No ads, and we don't sell your data. Post anonymously in Discuss whenever you like.",
  },
  {
    icon: IndianRupee,
    title: "Built for India",
    body: "Rupees, CIBIL scores, PPF, EPF and SIPs, not advice written for another country.",
  },
  {
    icon: Check,
    title: "Free to use",
    body: "Tracking, budgets, goals, Learn and Discuss are all free.",
  },
];

const previewTerms = ["sip", "credit-score", "emergency-fund", "old-vs-new-tax-regime"];


function Landing() {
  useTitle();
  const install = useInstallPrompt();

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-canvas" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-medium text-brand-700 bg-surface border border-brand-100 px-3 py-1 rounded-full">
              <EyeOff size={13} /> Ask anonymously. Learn freely.
            </p>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-ink-900 leading-[1.08]">
              Your friend for money.
            </h1>
            <p className="mt-5 text-lg text-ink-700 leading-relaxed max-w-xl">
              Track where your money goes, understand terms like SIP and CIBIL in plain English, and ask anything
              without judgment. Built for everyday people in India.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-700 transition"
              >
                Get started free <ArrowRight size={18} />
              </Link>
              <Link
                to="/learn"
                className="inline-flex items-center gap-2 bg-surface border border-line text-ink-900 px-6 py-3 rounded-xl font-medium hover:border-ink-300 transition"
              >
                Explore Learn
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-500">Free forever. No bank login needed.</p>
            {install && (
              <button
                onClick={install}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <Download size={16} /> Install the app on this device
              </button>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-md sm:pt-32 sm:pb-40" aria-hidden="true">
            <MiniBalance />
            <div className="mt-4 sm:mt-0 sm:absolute sm:-left-10 sm:bottom-0 sm:w-72">
              <MiniBudgets />
            </div>
            <div className="hidden sm:block absolute -right-6 top-0 w-64 rotate-2">
              <MiniQuestion />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink-900">
            What can you do with Money Mitra?
          </h2>
          <p className="mt-3 text-ink-500 text-lg">Four simple tools that work together, so money feels less confusing.</p>
        </div>
        <div className="mt-16 space-y-20 sm:space-y-28">
          {features.map((f, i) => (
            <div key={f.title} className="grid gap-10 lg:grid-cols-2 items-center">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-600">
                  <f.icon size={18} /> {f.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-ink-900">{f.title}</h3>
                <p className="mt-4 text-ink-700 leading-relaxed">{f.body}</p>
                <ul className="mt-6 space-y-2.5">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-ink-700">
                      <Check size={18} className="text-brand-600 shrink-0 mt-0.5" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`bg-ink-100/60 rounded-3xl p-6 sm:p-10 ${i % 2 === 1 ? "lg:order-1" : ""}`} aria-hidden="true">
                <div className="max-w-sm mx-auto">{f.visual}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 sm:mt-28">
          <h3 className="text-xl font-semibold tracking-tight text-ink-900">Also in Money Mitra</h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((x) => (
              <div key={x.title} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-5">
                <span className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
                  <x.icon size={17} />
                </span>
                <div>
                  <p className="font-medium text-ink-900">{x.title}</p>
                  <p className="mt-1 text-sm text-ink-500">{x.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="privacy" className="dark-panel scroll-mt-20 bg-ink-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Why Money Mitra?</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {promises.map((p) => (
              <div key={p.title}>
                <span className="inline-flex bg-ink-800 p-3 rounded-xl">
                  <p.icon size={22} className="text-brand-300" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-ink-300 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <TrendingUp size={28} className="mx-auto text-brand-600" />
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-ink-900">
          Money education for everyone, not just the privileged
        </h2>
        <p className="mt-5 text-lg text-ink-700 leading-relaxed">
          Plenty of people handle their daily money responsibly but were never taught about investing: banks, SIPs,
          mutual funds, where to actually start. Nobody sits you down and explains it. Money Mitra is here to close that
          gap, like a friend who tracks with you and teaches you along the way.
        </p>
      </section>

      {/* Learn preview */}
      <section className="bg-surface border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-ink-900">Start learning now, no account needed</h2>
              <p className="mt-2 text-ink-500">A few of the most asked-about terms.</p>
            </div>
            <Link to="/learn" className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700">
              See all terms <ArrowRight size={16} />
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previewTerms.map(termBySlug).filter((t) => t !== undefined).map((t) => (
              <li key={t.slug}>
                <Link
                  to={`/learn/${t.slug}`}
                  className="h-full flex flex-col bg-canvas border border-line rounded-2xl p-5 hover:border-ink-300 transition"
                >
                  <p className="text-xs font-medium text-ink-500">{t.level} · {t.topic}</p>
                  <p className="mt-2 font-semibold text-ink-900">{t.term}</p>
                  <p className="mt-1 text-sm text-ink-500 flex-1">{t.short}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                    Read <ArrowRight size={14} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Calculators */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-ink-900">Free money calculators</h2>
            <p className="mt-2 text-ink-500">Plan a SIP, check a loan EMI, or size your emergency fund in seconds.</p>
          </div>
          <Link to="/calculators" className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700">
            All calculators <ArrowRight size={16} />
          </Link>
        </div>
        <ul className="mt-10 grid gap-3 grid-cols-2 lg:grid-cols-5">
          {CALCULATORS.map((c) => {
            const Icon = CALCULATOR_ICONS[c.slug] ?? TrendingUp;
            return (
              <li key={c.slug}>
                <Link
                  to={`/calculators/${c.slug}`}
                  className="h-full flex flex-col items-start gap-3 bg-surface border border-line rounded-2xl p-5 hover:border-ink-300 transition"
                >
                  <span className="bg-brand-50 p-2.5 rounded-xl">
                    <Icon size={20} className="text-brand-600" />
                  </span>
                  <span className="font-medium text-ink-900">{c.name.replace(" calculator", "")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink-900 text-center">Questions, answered</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink-900">
                {f.q}
                <span className="text-ink-400 text-xl leading-none transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-ink-700 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final call to action */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="dark-panel bg-ink-900 rounded-3xl px-6 py-14 sm:px-14 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Start understanding your money today</h2>
          <p className="mt-4 text-ink-300 text-lg">Free, private, and made for people who were never taught this.</p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-500 transition"
          >
            Create your free account <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Landing;

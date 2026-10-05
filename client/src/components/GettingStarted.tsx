import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import api from "../lib/api";
import { onDataChange } from "../lib/dataEvents";
import { checklistHiddenKey, readFlag, readLearnSince, setFlag } from "../lib/checklist";

interface GettingStartedProps {
  account: { username: string; createdAt: string };
  hasTransactions: boolean;
  onAddTransaction: () => void;
}

// A short welcome checklist for new users; it disappears once everything is done or it's hidden
function GettingStarted({ account, hasTransactions, onAddTransaction }: GettingStartedProps) {
  const hiddenKey = checklistHiddenKey(account.username);
  const [hidden, setHidden] = useState(() => readFlag(hiddenKey));
  const [counts, setCounts] = useState<{ budgets: number; goals: number } | null>(null);
  const readLearn = readLearnSince(account.createdAt);

  useEffect(() => {
    if (hidden) return;
    let current = true;
    const load = () =>
      Promise.all([api.get("/budgets"), api.get("/goals")])
        .then(([b, g]) => current && setCounts({ budgets: b.data.budgets.length, goals: g.data.goals.length }))
        .catch(() => {});
    load();
    const stop = onDataChange(load);
    return () => {
      current = false;
      stop();
    };
  }, [hidden]);

  // Wait for the counts so the card doesn't flash with the wrong ticks
  if (hidden || !counts) return null;

  const steps = [
    { label: "Add your first transaction", done: hasTransactions, action: onAddTransaction },
    { label: "Set a monthly budget", done: counts.budgets > 0, to: "/tracker#budgets" },
    { label: "Create a savings goal", done: counts.goals > 0, to: "/tracker#goals" },
    { label: "Read a money term in Learn", done: readLearn, to: "/learn" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const hide = () => {
    setFlag(hiddenKey);
    setHidden(true);
  };

  return (
    <section className="bg-surface border border-line rounded-2xl p-6" aria-labelledby="getting-started">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="getting-started" className="font-semibold text-ink-900">Get started with Money Mitra</h2>
          <p className="mt-1 text-sm text-ink-500">
            {doneCount} of {steps.length} done. A few quick steps to get the most out of the app.
          </p>
        </div>
        <button onClick={hide} aria-label="Hide checklist" className="p-1 text-ink-400 hover:text-ink-900 transition">
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => {
          const content = (
            <>
              <span
                className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${
                  step.done ? "bg-brand-600 text-white" : "border-2 border-ink-200"
                }`}
              >
                {step.done && <Check size={14} strokeWidth={3} />}
              </span>
              <span className={step.done ? "text-ink-400 line-through" : "text-ink-900 font-medium"}>{step.label}</span>
            </>
          );
          const className = `w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm transition ${
            step.done ? "cursor-default" : "hover:bg-canvas"
          }`;
          return (
            <li key={step.label}>
              {step.done ? (
                <div className={className}>{content}</div>
              ) : step.to ? (
                <Link to={step.to} className={className}>{content}</Link>
              ) : (
                <button onClick={step.action} className={className}>{content}</button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default GettingStarted;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lightbulb, X, ArrowRight } from "lucide-react";
import api from "../lib/api";
import { termBySlug } from "../lib/learn";
import { chooseTip } from "../lib/tips";
import { onDataChange } from "../lib/dataEvents";
import { DISMISSED_TIPS_KEY, READ_TERMS_KEY, addToList, readList } from "../lib/checklist";

interface LearnTipCardProps {
  income: number;
  expense: number;
  categories: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// One Learn term picked for the user's situation, e.g. an emergency fund when they have none
function LearnTipCard({ income, expense, categories }: LearnTipCardProps) {
  const [goalNames, setGoalNames] = useState<string[] | null>(null);
  const [dismissedCount, setDismissedCount] = useState(0);
  // Local date, read once, so the "term of the day" changes at the user's midnight
  const [dayIndex] = useState(() => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / DAY_MS));

  useEffect(() => {
    let current = true;
    const load = () =>
      api
        .get("/goals")
        .then((res) => current && setGoalNames(res.data.goals.map((g: { name: string }) => g.name)))
        .catch(() => current && setGoalNames([]));
    load();
    const stop = onDataChange(load);
    return () => {
      current = false;
      stop();
    };
  }, []);

  if (goalNames === null) return null;

  const skip = new Set([...readList(READ_TERMS_KEY), ...readList(DISMISSED_TIPS_KEY)]);
  const tip = chooseTip({ income, expense, categories, goalNames, skip, dayIndex });
  const term = tip && termBySlug(tip.slug);
  if (!tip || !term) return null;

  const dismiss = () => {
    addToList(DISMISSED_TIPS_KEY, tip.slug);
    setDismissedCount(dismissedCount + 1);
  };

  return (
    <section className="bg-brand-50 border border-brand-100 rounded-2xl p-6 flex flex-col" aria-labelledby="tip-title">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700">
          <Lightbulb size={14} /> Tip for you
        </p>
        <button onClick={dismiss} aria-label="Dismiss tip" className="p-1 -m-1 text-ink-400 hover:text-ink-900 transition">
          <X size={16} />
        </button>
      </div>
      <h2 id="tip-title" className="mt-3 font-semibold text-ink-900 leading-snug">{tip.headline}</h2>
      <p className="mt-2 text-sm text-ink-700 leading-relaxed flex-1">{term.short}</p>
      <Link
        to={`/learn/${term.slug}`}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-600"
      >
        Read about {term.term} <ArrowRight size={14} />
      </Link>
    </section>
  );
}

export default LearnTipCard;

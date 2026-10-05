import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Info, BookOpen } from "lucide-react";
import { termBySlug } from "../lib/learn";
import Emphasised from "./Emphasised";

export interface Insight {
  id: string;
  tone: "good" | "warning" | "neutral";
  message: string;
  learnSlug?: string;
}

const TONE = {
  good: { icon: CheckCircle2, color: "text-gain" },
  warning: { icon: AlertTriangle, color: "text-warn" },
  neutral: { icon: Info, color: "text-ink-400" },
};

interface InsightsCardProps {
  insights: Insight[];
  monthLabel: string;
  isCurrentMonth: boolean;
}

function InsightsCard({ insights, monthLabel, isCurrentMonth }: InsightsCardProps) {
  if (insights.length === 0) return null;

  return (
    <section className="bg-surface p-6 rounded-2xl border border-line" aria-labelledby="insights-title">
      <h2 id="insights-title" className="font-semibold text-ink-900">
        {isCurrentMonth ? "What we noticed this month" : `What we noticed in ${monthLabel}`}
      </h2>
      <ul className="mt-4 space-y-4">
        {insights.map((insight) => {
          const { icon: Icon, color } = TONE[insight.tone];
          const learn = insight.learnSlug ? termBySlug(insight.learnSlug) : undefined;
          return (
            <li key={insight.id} className="flex gap-3">
              <Icon size={18} className={`shrink-0 mt-0.5 ${color}`} aria-hidden="true" />
              <div className="text-sm text-ink-700 leading-relaxed">
                <p>
                  <Emphasised text={insight.message} />
                </p>
                {learn && (
                  <Link to={`/learn/${learn.slug}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                    <BookOpen size={12} /> Learn: {learn.term}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default InsightsCard;

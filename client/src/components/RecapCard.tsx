import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, X } from "lucide-react";
import api from "../lib/api";
import { formatINR } from "../lib/ui";
import { announceNotificationsChange } from "../lib/dataEvents";
import type { RecapSummary } from "../lib/recap";
import Emphasised from "./Emphasised";

// Last month's recap during the first week of a new month, until the user closes it
function RecapCard() {
  const [recap, setRecap] = useState<RecapSummary | null>(null);

  useEffect(() => {
    let current = true;
    api
      .get("/recaps/latest", { params: { tzOffset: new Date().getTimezoneOffset() } })
      .then((res) => {
        if (!current) return;
        setRecap(res.data.recap);
        // The bell gets a "recap is ready" notification the first time
        if (res.data.notified) announceNotificationsChange();
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  if (!recap) return null;

  const dismiss = () => {
    setRecap(null);
    api.post(`/recaps/${recap.month}/dismiss`).catch(() => {});
  };

  const { totals, previous } = recap;
  const savedDiff = previous ? totals.saved - previous.saved : null;
  const shortMonth = recap.monthName.split(" ")[0];

  return (
    <section className="bg-surface border border-brand-100 rounded-2xl p-6" aria-labelledby="recap-card-title">
      <div className="flex items-start justify-between gap-4">
        <h2 id="recap-card-title" className="flex items-center gap-2 font-semibold text-ink-900">
          <CalendarCheck size={18} className="text-brand-600" /> Your {shortMonth} recap
        </h2>
        <button onClick={dismiss} aria-label="Close recap" className="p-1 -m-1 text-ink-400 hover:text-ink-900 transition">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{totals.saved >= 0 ? "Saved" : "Overspent"}</p>
          <p className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${totals.saved >= 0 ? "text-ink-900" : "text-loss"}`}>
            {formatINR(Math.abs(totals.saved))}
          </p>
          {totals.savingsRate !== null && totals.saved >= 0 && (
            <p className="text-sm text-ink-500">{totals.savingsRate}% of your income</p>
          )}
        </div>
        <dl className="grid w-full grid-cols-3 gap-x-5 gap-y-1 text-sm sm:flex sm:w-auto sm:gap-8">
          <div>
            <dt className="text-ink-500 whitespace-nowrap">Money in</dt>
            <dd className="font-medium text-ink-900 tabular-nums">{formatINR(totals.income)}</dd>
          </div>
          <div>
            <dt className="text-ink-500 whitespace-nowrap">Money out</dt>
            <dd className="font-medium text-ink-900 tabular-nums">{formatINR(totals.expense)}</dd>
          </div>
          {savedDiff !== null && Math.round(savedDiff) !== 0 && (
            <div>
              <dt className="text-ink-500 whitespace-nowrap">Vs {recap.previousMonthName}</dt>
              <dd className={`font-medium tabular-nums ${savedDiff > 0 ? "text-gain" : "text-ink-900"}`}>
                {formatINR(Math.abs(savedDiff))} {savedDiff > 0 ? "more saved" : "less saved"}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {recap.wentWell && (
        <p className="mt-4 text-sm text-ink-700 leading-relaxed">
          <Emphasised text={recap.wentWell} />
        </p>
      )}

      <Link
        to={`/tracker/recap/${recap.month}`}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        See full recap <ArrowRight size={15} />
      </Link>
    </section>
  );
}

export default RecapCard;

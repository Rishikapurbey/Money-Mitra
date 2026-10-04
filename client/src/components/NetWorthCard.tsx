import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Landmark } from "lucide-react";
import api from "../lib/api";
import { formatINR } from "../lib/ui";
import { announceNotificationsChange } from "../lib/dataEvents";
import { signedINR } from "../lib/networth";
import type { NetWorthSummary } from "../lib/networth";

// Net worth at a glance on Home, or an invitation to start tracking it
function NetWorthCard() {
  const [summary, setSummary] = useState<NetWorthSummary | null | undefined>(undefined);

  useEffect(() => {
    let current = true;
    api
      .get("/networth/summary", { params: { tzOffset: new Date().getTimezoneOffset() } })
      .then((res) => {
        if (!current) return;
        setSummary(res.data.summary);
        // A "time to update" reminder may have just gone to the bell
        if (res.data.notified) announceNotificationsChange();
      })
      .catch(() => current && setSummary(undefined));
    return () => {
      current = false;
    };
  }, []);

  if (summary === undefined) return null;

  return (
    <section className="bg-surface border border-line rounded-2xl p-5" aria-labelledby="networth-card-title">
      <h2 id="networth-card-title" className="flex items-center gap-2 font-semibold text-ink-900">
        <Landmark size={17} className="text-brand-600" /> Net worth
      </h2>
      {summary ? (
        <>
          <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${summary.netWorth < 0 ? "text-loss" : "text-ink-900"}`}>
            {summary.netWorth < 0 ? "−" : ""}
            {formatINR(Math.abs(summary.netWorth))}
          </p>
          <p className="text-xs text-ink-500">
            {summary.changeThisMonth !== null && summary.changeThisMonth !== 0 && (
              <span className={summary.changeThisMonth > 0 ? "text-gain font-medium" : ""}>{signedINR(summary.changeThisMonth)} in 30 days · </span>
            )}
            {summary.stale ? "Values are over a month old" : "Up to date"}
          </p>
          <Link to="/tracker/net-worth" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            {summary.stale ? "Update values" : "See details"} <ArrowRight size={15} />
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-ink-500">Add what you own and owe to see where you stand overall.</p>
          <Link to="/tracker/net-worth" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            Get started <ArrowRight size={15} />
          </Link>
        </>
      )}
    </section>
  );
}

export default NetWorthCard;

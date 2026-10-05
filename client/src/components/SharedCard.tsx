import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, UsersRound } from "lucide-react";
import api from "../lib/api";
import { formatINR } from "../lib/ui";
import { onDataChange } from "../lib/dataEvents";

interface SharedSummary {
  owe: number;
  owed: number;
  groups: { id: string; name: string; balance: number }[];
  invites: number;
}

// What the user owes and is owed in shared groups; only shown while something is open
function SharedCard() {
  const [summary, setSummary] = useState<SharedSummary | null>(null);

  useEffect(() => {
    let current = true;
    const load = () =>
      api
        .get("/shared/summary")
        .then((res) => current && setSummary(res.data))
        .catch(() => {});
    load();
    const stop = onDataChange(load);
    return () => {
      current = false;
      stop();
    };
  }, []);

  if (!summary || (summary.groups.length === 0 && summary.invites === 0)) return null;
  const shown = summary.groups.slice(0, 3);

  return (
    <section className="bg-surface border border-line rounded-2xl p-5" aria-labelledby="shared-card-title">
      <h2 id="shared-card-title" className="flex items-center gap-2 font-semibold text-ink-900">
        <UsersRound size={17} className="text-brand-600" /> Shared expenses
      </h2>
      {summary.groups.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-ink-500">You owe</p>
            <p className="text-xl font-semibold tabular-nums text-ink-900">{formatINR(summary.owe)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">You're owed</p>
            <p className={`text-xl font-semibold tabular-nums ${summary.owed > 0 ? "text-brand-600" : "text-ink-900"}`}>{formatINR(summary.owed)}</p>
          </div>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {shown.map((g) => (
            <li key={g.id}>
              <Link to={`/shared/${g.id}`} className="flex justify-between gap-3 hover:underline">
                <span className="text-ink-700 truncate">{g.name}</span>
                <span className={`shrink-0 tabular-nums ${g.balance > 0 ? "text-brand-600" : "text-ink-900"}`}>
                  {g.balance > 0 ? `owed ${formatINR(g.balance)}` : `you owe ${formatINR(-g.balance)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {summary.invites > 0 && (
        <p className="mt-3 text-sm text-ink-700">
          {summary.invites === 1 ? "1 group invite is" : `${summary.invites} group invites are`} waiting for you.
        </p>
      )}
      <Link to="/shared" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        {summary.invites > 0 ? "See invites" : "See all groups"} <ArrowRight size={15} />
      </Link>
    </section>
  );
}

export default SharedCard;

import { Link } from "react-router-dom";
import { ArrowRight, Wallet } from "lucide-react";
import { formatINR } from "../lib/ui";
import { useAccounts } from "../lib/accounts";
import type { Account } from "../lib/accounts";

// What's under an account's balance: a warning when it's below zero, or how much of a card's limit is used
function detail(a: Account) {
  if (a.kind === "asset") return a.value < 0 ? { text: "Spent more than it held", warn: true } : null;
  if (!a.creditLimit) return { text: "Owed on the card", warn: false };
  const used = Math.round((a.value / a.creditLimit) * 100);
  return { text: `${used}% of ${formatINR(a.creditLimit)} limit used`, warn: used >= 80 };
}

// Each account's balance at a glance on Home; hidden until the first account is added
function AccountsCard() {
  const { accounts } = useAccounts();
  if (accounts.length === 0) return null;

  return (
    <section className="bg-surface border border-line rounded-2xl p-5" aria-labelledby="accounts-card-title">
      <h2 id="accounts-card-title" className="flex items-center gap-2 font-semibold text-ink-900">
        <Wallet size={17} className="text-brand-600" /> Accounts
      </h2>
      <ul className="mt-3 divide-y divide-line">
        {accounts.map((a) => {
          const note = detail(a);
          const negative = a.kind === "asset" && a.value < 0;
          return (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">
                  {a.name}
                  {a.isDefault && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-brand-700">Default</span>}
                </p>
                {note && <p className={`text-xs ${note.warn ? "text-loss" : "text-ink-500"}`}>{note.text}</p>}
              </div>
              <p className={`shrink-0 text-sm font-semibold tabular-nums ${negative ? "text-loss" : "text-ink-900"}`}>{formatINR(a.value)}</p>
            </li>
          );
        })}
      </ul>
      <Link to="/tracker/net-worth" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        Manage accounts <ArrowRight size={15} />
      </Link>
    </section>
  );
}

export default AccountsCard;

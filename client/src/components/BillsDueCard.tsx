import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { Receipt, X } from "lucide-react";
import api from "../lib/api";
import { formatINR, inputClass } from "../lib/ui";
import { useToast } from "../lib/toast";
import { announceDataChange, onDataChange } from "../lib/dataEvents";
import { withBudgetAlert } from "../lib/budgetAlerts";
import { billsDue, daysUntil, dueLabel, ruleName } from "../lib/recurring";
import type { RecurringRule } from "../lib/recurring";

// Bills set to "remind me to pay" that are overdue or due this week, with Mark paid and Skip
function BillsDueCard() {
  const toast = useToast();
  const [bills, setBills] = useState<RecurringRule[]>([]);
  const [paying, setPaying] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    const load = () =>
      api
        .get("/recurring")
        .then((res) => current && setBills(billsDue(res.data.recurring)))
        .catch(() => {});
    load();
    const stop = onDataChange(load);
    return () => {
      current = false;
      stop();
    };
  }, []);

  if (bills.length === 0) return null;

  const startPaying = (bill: RecurringRule) => {
    setPaying(bill.id);
    setAmount(bill.amount !== null ? String(bill.amount) : "");
    setError("");
  };

  const settle = async (bill: RecurringRule, action: "pay" | "skip") => {
    setBusy(true);
    setError("");
    try {
      const res =
        action === "pay"
          ? await api.post(`/recurring/${bill.id}/pay`, { amount: parseFloat(amount), tzOffset: new Date().getTimezoneOffset() })
          : await api.post(`/recurring/${bill.id}/skip`);
      setPaying(null);
      announceDataChange();
      toast({
        message:
          action === "pay"
            ? withBudgetAlert(`${ruleName(bill)} marked paid: ${formatINR(parseFloat(amount))} added as an expense`, res.data.budgetAlert)
            : `${ruleName(bill)} skipped this time`,
      });
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't update that bill. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-surface border border-line rounded-2xl p-6" aria-labelledby="bills-due-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="bills-due-title" className="flex items-center gap-2 font-semibold text-ink-900">
          <Receipt size={18} className="text-brand-600" /> Bills due
        </h2>
        <Link to="/tracker#recurring" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          All bills
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {bills.map((bill) => {
          const overdue = daysUntil(bill.nextDue) < 0;
          return (
            <li key={bill.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{ruleName(bill)}</p>
                  <p className={`text-xs ${overdue ? "text-loss font-medium" : "text-ink-500"}`}>{dueLabel(bill.nextDue)}</p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink-900">
                  {bill.amount !== null ? formatINR(bill.amount) : <span className="font-normal text-ink-500">Amount varies</span>}
                </span>
              </div>
              {paying === bill.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    settle(bill, "pay");
                  }}
                  className="mt-2 flex flex-wrap items-center gap-2"
                >
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    autoFocus
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount paid"
                    aria-label="Amount paid"
                    className={`${inputClass} py-1.5 text-sm w-36 tabular-nums`}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setPaying(null)} aria-label="Cancel" className="text-ink-400 hover:text-ink-900">
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <button onClick={() => startPaying(bill)} className="font-medium text-brand-600 hover:text-brand-700">
                    Mark paid
                  </button>
                  <button onClick={() => settle(bill, "skip")} disabled={busy} className="text-ink-500 hover:text-ink-900 disabled:opacity-60">
                    Skip this time
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-loss">{error}</p>}
    </section>
  );
}

export default BillsDueCard;

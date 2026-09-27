import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Pause, Pencil, Play, Repeat, Trash2, X } from "lucide-react";
import api from "../lib/api";
import { formatINR, inputClass } from "../lib/ui";
import { useToast } from "../lib/toast";
import { announceDataChange, onDataChange } from "../lib/dataEvents";
import { ordinal, shortDate } from "../lib/recurring";
import type { RecurringRule } from "../lib/recurring";

// Recurring transactions: what repeats, when it's next added, and pause, edit or stop
function RecurringCard() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    let current = true;
    const load = () =>
      api
        .get("/recurring")
        .then((res) => current && setRules(res.data.recurring))
        .catch(() => current && setError("We couldn't load your recurring transactions."));
    load();
    const stop = onDataChange(load);
    return () => {
      current = false;
      stop();
    };
  }, []);

  const replace = (rule: RecurringRule) => setRules((current) => current.map((r) => (r.id === rule.id ? rule : r)));

  const togglePause = async (rule: RecurringRule) => {
    try {
      const res = await api.post(`/recurring/${rule.id}/${rule.paused ? "resume" : "pause"}`);
      replace(res.data.recurring);
      toast({ message: rule.paused ? `${rule.category} resumed` : `${rule.category} paused` });
    } catch {
      setError("We couldn't update that. Please try again.");
    }
  };

  const stop = async (rule: RecurringRule) => {
    try {
      await api.delete(`/recurring/${rule.id}`);
      setRules((current) => current.filter((r) => r.id !== rule.id));
      setConfirmStop(null);
      announceDataChange();
      toast({ message: `${rule.category} will no longer repeat` });
    } catch {
      setError("We couldn't stop that. Please try again.");
    }
  };

  const openEdit = (rule: RecurringRule) => {
    setEditing(rule);
    setAmount(String(rule.amount));
    setDay(String(rule.dayOfMonth));
    setEndDate(rule.endDate ? rule.endDate.slice(0, 10) : "");
    setError("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      const res = await api.put(`/recurring/${editing.id}`, {
        amount: parseFloat(amount),
        type: editing.type,
        category: editing.category,
        note: editing.note,
        dayOfMonth: parseInt(day, 10),
        endDate: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
      });
      replace(res.data.recurring);
      setEditing(null);
      toast({ message: `${editing.category} updated` });
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't save that. Please try again.");
    }
  };

  return (
    <section id="recurring" className="bg-surface p-6 rounded-2xl border border-line scroll-mt-24" aria-labelledby="recurring-title">
      <div>
        <h2 id="recurring-title" className="font-semibold text-ink-900">Recurring</h2>
        <p className="text-xs text-ink-500 mt-0.5">Added automatically every month</p>
      </div>

      {error && <p className="mt-3 text-loss text-sm bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}

      {rules.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 text-sm text-ink-500">
          <Repeat size={18} className="shrink-0 text-brand-600 mt-0.5" />
          <p>
            Salary, rent, SIPs or EMIs? Tick <span className="font-medium text-ink-700">Repeat every month</span> when you
            add one, and it will be added for you each month.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {rules.map((rule) => (
            <li key={rule.id} className="py-3">
              {editing?.id === rule.id ? (
                <form onSubmit={saveEdit} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink-900">Edit {rule.category}</p>
                    <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="text-ink-400 hover:text-ink-900">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-xs text-ink-500">
                      Amount
                      <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-full mt-1 tabular-nums`} required />
                    </label>
                    <label className="text-xs text-ink-500">
                      Day of the month
                      <input type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} w-full mt-1 tabular-nums`} required />
                    </label>
                    <label className="text-xs text-ink-500">
                      Ends (optional)
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} w-full mt-1`} />
                    </label>
                  </div>
                  <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition">
                    Save changes
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${rule.paused ? "text-ink-400" : "text-ink-900"}`}>
                      {rule.category}{" "}
                      <span className={`tabular-nums ${rule.type === "income" ? "text-gain" : "text-ink-700"}`}>
                        {rule.type === "income" ? "+" : "−"}
                        {formatINR(rule.amount)}
                      </span>
                    </p>
                    <p className="text-xs text-ink-500">
                      {rule.paused
                        ? "Paused"
                        : `Every month on the ${ordinal(rule.dayOfMonth)} · next ${shortDate(rule.nextDue)}`}
                      {rule.endDate && ` · until ${new Date(rule.endDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`}
                    </p>
                  </div>
                  {confirmStop === rule.id ? (
                    <span className="flex items-center gap-2 text-xs shrink-0">
                      <span className="text-ink-700">Stop repeating?</span>
                      <button onClick={() => stop(rule)} className="font-medium text-loss hover:underline">Stop</button>
                      <button onClick={() => setConfirmStop(null)} className="text-ink-500 hover:text-ink-900">Cancel</button>
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => togglePause(rule)} aria-label={rule.paused ? `Resume ${rule.category}` : `Pause ${rule.category}`} className="p-1 text-ink-300 hover:text-brand-600 transition">
                        {rule.paused ? <Play size={15} /> : <Pause size={15} />}
                      </button>
                      <button onClick={() => openEdit(rule)} aria-label={`Edit ${rule.category}`} className="p-1 text-ink-300 hover:text-brand-600 transition">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setConfirmStop(rule.id)} aria-label={`Stop ${rule.category}`} className="p-1 text-ink-300 hover:text-loss transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {rules.length > 0 && (
        <p className="mt-3 text-xs text-ink-400">Stopping keeps the entries already added.</p>
      )}
    </section>
  );
}

export default RecurringCard;

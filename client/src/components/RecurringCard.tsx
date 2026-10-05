import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Pause, Pencil, Play, Repeat, Trash2, X } from "lucide-react";
import api from "../lib/api";
import { formatINR, inputClass } from "../lib/ui";
import { useToast } from "../lib/toast";
import { announceDataChange, onDataChange } from "../lib/dataEvents";
import { ruleName, scheduleLabel, shortDate } from "../lib/recurring";
import type { RecurringRule } from "../lib/recurring";

// Recurring transactions: what repeats, when it's next added, and pause, edit or stop
function RecurringCard() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mode, setMode] = useState<RecurringRule["mode"]>("auto");
  const [frequency, setFrequency] = useState<RecurringRule["frequency"]>("monthly");
  const [monthOfYear, setMonthOfYear] = useState(0);
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
    setAmount(rule.amount !== null ? String(rule.amount) : "");
    setDay(String(rule.dayOfMonth));
    setMode(rule.mode);
    setFrequency(rule.frequency);
    setMonthOfYear(rule.monthOfYear ?? new Date(rule.nextDue).getMonth());
    setEndDate(rule.endDate ? rule.endDate.slice(0, 10) : "");
    setError("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      const res = await api.put(`/recurring/${editing.id}`, {
        // A bill's amount can be left empty when it varies
        amount: amount === "" ? null : parseFloat(amount),
        type: editing.type,
        category: editing.category,
        note: editing.note,
        mode,
        frequency,
        monthOfYear: frequency === "yearly" ? monthOfYear : null,
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
        <p className="text-xs text-ink-500 mt-0.5">Added for you, or bills you mark paid when they're due</p>
      </div>

      {error && <p className="mt-3 text-loss text-sm bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}

      {rules.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 text-sm text-ink-500">
          <Repeat size={18} className="shrink-0 text-brand-600 mt-0.5" />
          <p>
            Salary, rent, SIPs, EMIs or a credit card bill? Tick <span className="font-medium text-ink-700">Repeat</span> when
            you add one. It can be added for you, or you can get a reminder to pay it.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {rules.map((rule) => (
            <li key={rule.id} className="py-3">
              {editing?.id === rule.id ? (
                <form onSubmit={saveEdit} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink-900">Edit {ruleName(rule)}</p>
                    <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="text-ink-400 hover:text-ink-900">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs text-ink-500">
                      When it's due
                      <select value={mode} onChange={(e) => setMode(e.target.value as RecurringRule["mode"])} className={`${inputClass} w-full mt-1 text-sm`}>
                        <option value="auto">Add it automatically</option>
                        <option value="remind">Remind me to pay</option>
                      </select>
                    </label>
                    <label className="text-xs text-ink-500">
                      Repeats
                      <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringRule["frequency"])} className={`${inputClass} w-full mt-1 text-sm`}>
                        <option value="monthly">Every month</option>
                        <option value="yearly">Every year</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-xs text-ink-500">
                      Amount{mode === "remind" && " (empty if it varies)"}
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={mode === "remind" ? "Varies" : undefined}
                        className={`${inputClass} w-full mt-1 tabular-nums`}
                        required={mode === "auto"}
                      />
                    </label>
                    {frequency === "yearly" && (
                      <label className="text-xs text-ink-500">
                        Month
                        <select value={monthOfYear} onChange={(e) => setMonthOfYear(Number(e.target.value))} className={`${inputClass} w-full mt-1 text-sm`}>
                          {Array.from({ length: 12 }, (_, m) => (
                            <option key={m} value={m}>
                              {new Date(2000, m, 1).toLocaleDateString("en-IN", { month: "long" })}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="text-xs text-ink-500">
                      Day
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
                      {ruleName(rule)}{" "}
                      {rule.amount !== null ? (
                        <span className={`tabular-nums ${rule.type === "income" ? "text-gain" : "text-ink-700"}`}>
                          {rule.type === "income" ? "+" : "−"}
                          {formatINR(rule.amount)}
                        </span>
                      ) : (
                        <span className="font-normal text-ink-500">· amount varies</span>
                      )}
                      {rule.mode === "remind" && (
                        <span className="ml-2 align-middle text-[11px] font-medium text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">Bill</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-500">
                      {rule.paused
                        ? "Paused"
                        : `${scheduleLabel(rule)} · ${rule.mode === "remind" ? "due" : "next"} ${shortDate(rule.nextDue)}`}
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

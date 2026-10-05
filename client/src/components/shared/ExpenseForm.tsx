import { useState } from "react";
import { isAxiosError } from "axios";
import api from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatINR, inputClass } from "../../lib/ui";
import { toInputDate, transactionTimestamp } from "../../lib/dates";
import { announceDataChange } from "../../lib/dataEvents";
import { withBudgetAlert } from "../../lib/budgetAlerts";
import { quickPicks, useCategories } from "../../lib/categories";
import { splitEqually, unassigned } from "../../lib/shared";
import type { GroupDetail, SharedExpense } from "../../lib/shared";

const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

// Adding or editing a group expense: who paid, and how it's split
function ExpenseForm({ group, expense, onDone }: { group: GroupDetail; expense?: SharedExpense; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const { categories } = useCategories();
  // Current members, plus anyone already on the expense being edited (they may have left since)
  const people = group.members.filter(
    (m) => m.status === "active" || (expense && (expense.paidById === m.id || expense.shares.some((s) => s.memberId === m.id)))
  );
  const label = (m: { isMe: boolean; name: string }) => (m.isMe ? `${m.name} (you)` : m.name);

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [date, setDate] = useState(toInputDate(expense ? new Date(expense.date) : new Date()));
  const [paidById, setPaidById] = useState(expense?.paidById ?? group.myMemberId);
  const evenly = !expense || new Set(expense.shares.map((s) => Math.round(s.amount))).size <= 1;
  const [mode, setMode] = useState<"equal" | "exact">(evenly ? "equal" : "exact");
  const [included, setIncluded] = useState<Set<string>>(
    new Set(expense ? expense.shares.map((s) => s.memberId) : people.filter((m) => m.status === "active").map((m) => m.id))
  );
  const [exact, setExact] = useState<Record<string, string>>(
    Object.fromEntries((expense?.shares ?? []).map((s) => [s.memberId, String(s.amount)]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = Number(amount) || 0;
  const chosen = people.filter((m) => included.has(m.id));
  const evenShares = splitEqually(total, chosen.length);
  const left = unassigned(total, people.map((m) => Number(exact[m.id]) || 0));

  const toggle = (id: string) =>
    setIncluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "equal" && chosen.length === 0) return setError("Choose who to split it between");
    if (mode === "exact" && left !== 0) return setError(left > 0 ? `${formatINR(left)} still to assign` : `The shares are ${formatINR(-left)} over the total`);
    setBusy(true);
    setError("");
    const body = {
      description,
      amount: total,
      category,
      // Keep the original time when the day wasn't changed, so the activity doesn't report a new date
      date: expense && toInputDate(new Date(expense.date)) === date ? expense.date : transactionTimestamp(date),
      paidById,
      split:
        mode === "equal"
          ? { type: "equal", memberIds: chosen.map((m) => m.id) }
          : { type: "exact", shares: people.map((m) => ({ memberId: m.id, amount: Number(exact[m.id]) || 0 })) },
      tzOffset: new Date().getTimezoneOffset(),
    };
    try {
      const res = expense
        ? await api.put(`/shared/groups/${group.id}/expenses/${expense.id}`, body)
        : await api.post(`/shared/groups/${group.id}/expenses`, body);
      announceDataChange();
      toast({ message: withBudgetAlert(expense ? "Expense updated" : `${description.trim()} added`, res.data.budgetAlert) });
      onDone(true);
    } catch (err) {
      setError(errorText(err, "We couldn't save the expense. Please try again."));
      setBusy(false);
    }
  };

  const picks = quickPicks([], categories, "expense");

  return (
    <form onSubmit={submit} className="bg-surface border border-brand-500 ring-2 ring-brand-100 rounded-2xl p-6 space-y-4">
      <h2 className="font-semibold text-ink-900">{expense ? "Edit expense" : "Add an expense"}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink-700">
          What was it for
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={60}
            required
            autoFocus={!expense}
            placeholder="e.g. Dinner, Hotel, Cab"
            className={`${inputClass} w-full mt-1 font-normal`}
          />
        </label>
        <label className="block text-sm font-medium text-ink-700">
          Amount
          <div className="relative mt-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 font-normal">₹</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className={`${inputClass} w-full !pl-8 font-semibold tabular-nums`}
            />
          </div>
        </label>
        <label className="block text-sm font-medium text-ink-700">
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={50}
            required
            list="shared-categories"
            autoComplete="off"
            placeholder="e.g. Food, Travel"
            className={`${inputClass} w-full mt-1 font-normal`}
          />
          <datalist id="shared-categories">
            {categories
              .filter((c) => c.type === "expense")
              .map((c) => (
                <option key={c.id} value={c.name} />
              ))}
          </datalist>
        </label>
        <label className="block text-sm font-medium text-ink-700">
          Date
          <input
            type="date"
            value={date}
            max={toInputDate(new Date())}
            onChange={(e) => setDate(e.target.value)}
            required
            className={`${inputClass} w-full mt-1 font-normal`}
          />
        </label>
      </div>
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2 -mt-1">
          {picks.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                category === c ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-700 hover:border-ink-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <label className="block text-sm font-medium text-ink-700">
        Paid by
        <select value={paidById} onChange={(e) => setPaidById(e.target.value)} className={`${inputClass} w-full mt-1 font-normal`}>
          {people.map((m) => (
            <option key={m.id} value={m.id}>
              {label(m)}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm font-medium text-ink-700">Split</legend>
          <div role="radiogroup" aria-label="How to split" className="grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium">
            {(
              [
                { value: "equal", label: "Equally" },
                { value: "exact", label: "Exact amounts" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={mode === o.value}
                onClick={() => {
                  setMode(o.value);
                  setError("");
                }}
                className={`px-3 py-1.5 rounded-lg transition ${mode === o.value ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="rounded-xl border border-line divide-y divide-line">
          {people.map((m) => {
            const evenIndex = chosen.findIndex((c) => c.id === m.id);
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                {mode === "equal" ? (
                  <>
                    <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <input type="checkbox" checked={included.has(m.id)} onChange={() => toggle(m.id)} className="w-4 h-4 accent-brand-600" />
                      <span className="text-sm text-ink-900 truncate">{label(m)}</span>
                    </label>
                    <span className="text-sm tabular-nums text-ink-500">{evenIndex >= 0 && total > 0 ? formatINR(evenShares[evenIndex]) : "—"}</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-ink-900 truncate flex-1 min-w-0">{label(m)}</span>
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={exact[m.id] ?? ""}
                        onChange={(e) => setExact((current) => ({ ...current, [m.id]: e.target.value }))}
                        aria-label={`${m.name}'s share`}
                        placeholder="0"
                        className={`${inputClass} w-full !pl-7 py-1.5 text-sm tabular-nums`}
                      />
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {mode === "exact" && total > 0 && (
          <p className={`text-xs ${left === 0 ? "text-ink-500" : "text-loss"}`}>
            {left === 0 ? "The shares match the total." : left > 0 ? `${formatINR(left)} still to assign` : `${formatINR(-left)} over the total`}
          </p>
        )}
      </fieldset>

      <p className="text-xs text-ink-500">Each person on Money Mitra gets their share in their own Tracker as an expense.</p>
      {error && <p role="alert" className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60"
        >
          {busy ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </button>
        <button type="button" onClick={() => onDone(false)} className="text-sm text-ink-500 hover:text-ink-900">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default ExpenseForm;

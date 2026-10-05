import { useState } from "react";
import { isAxiosError } from "axios";
import api from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatINR, inputClass } from "../../lib/ui";
import { toInputDate, transactionTimestamp } from "../../lib/dates";
import type { GroupDetail, Payment } from "../../lib/shared";

const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

// Recording that one member paid another back. It's a transfer, so it never touches anyone's Tracker.
function SettleForm({ group, suggestion, onDone }: { group: GroupDetail; suggestion: Payment | null; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const people = group.members.filter((m) => m.status === "active");
  const firstOther = people.find((m) => m.id !== group.myMemberId)?.id ?? "";
  const [fromId, setFromId] = useState(suggestion?.fromMemberId ?? group.myMemberId);
  const [toId, setToId] = useState(suggestion?.toMemberId ?? firstOther);
  const [amount, setAmount] = useState(suggestion ? String(suggestion.amount) : "");
  const [date, setDate] = useState(toInputDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameOf = (id: string) => people.find((m) => m.id === id)?.name ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post(`/shared/groups/${group.id}/settlements`, {
        fromMemberId: fromId,
        toMemberId: toId,
        amount: Number(amount),
        date: transactionTimestamp(date),
      });
      toast({ message: `Recorded: ${nameOf(fromId)} paid ${nameOf(toId)} ${formatINR(Number(amount))}` });
      onDone(true);
    } catch (err) {
      setError(errorText(err, "We couldn't record the payment. Please try again."));
      setBusy(false);
    }
  };

  const select = (value: string, onChange: (id: string) => void, labelText: string) => (
    <label className="block text-sm font-medium text-ink-700">
      {labelText}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} w-full mt-1 font-normal`}>
        {people.map((m) => (
          <option key={m.id} value={m.id}>
            {m.isMe ? `${m.name} (you)` : m.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form onSubmit={submit} className="bg-surface border border-brand-500 ring-2 ring-brand-100 rounded-2xl p-6 space-y-4">
      <h2 className="font-semibold text-ink-900">Record a payment</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {select(fromId, setFromId, "Who paid")}
        {select(toId, setToId, "Who got the money")}
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
      <p className="text-xs text-ink-500">Paying someone back isn't spending, so it doesn't appear in anyone's Tracker.</p>
      {error && <p role="alert" className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || fromId === toId}
          className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60"
        >
          {busy ? "Saving…" : "Record payment"}
        </button>
        <button type="button" onClick={() => onDone(false)} className="text-sm text-ink-500 hover:text-ink-900">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default SettleForm;

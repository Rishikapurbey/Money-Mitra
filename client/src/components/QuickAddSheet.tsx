import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import api from "../lib/api";
import { inputClass, formatINR } from "../lib/ui";
import { toInputDate, transactionTimestamp } from "../lib/dates";
import { useToast } from "../lib/toast";

interface QuickAddSheetProps {
  type: "expense" | "income";
  // Categories the user already uses, offered as one-tap choices
  recentCategories: string[];
  onClose: () => void;
  onSaved: () => void;
}

// A small panel for logging a transaction in a few taps: a bottom sheet on phones, a dialog on desktop
function QuickAddSheet({ type: initialType, recentCategories, onClose, onSaved }: QuickAddSheetProps) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    amountRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const value = parseFloat(amount);
      await api.post("/transactions", { amount: value, type, category, note, date: transactionTimestamp(date) });
      toast({ message: `${type === "income" ? "Income" : "Expense"} of ${formatINR(value)} added` });
      onSaved();
      onClose();
    } catch {
      setError("We couldn't save that. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        className="relative w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl p-6 pb-8 sm:pb-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 id="quick-add-title" className="font-semibold text-ink-900">Quick add</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 -m-1 text-ink-400 hover:text-ink-900 transition">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-2 rounded-lg capitalize transition ${type === t ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500 text-xl font-medium">₹</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
            className={`${inputClass} w-full pl-10 py-3 text-2xl font-semibold tabular-nums`}
            required
          />
        </div>

        <div>
          <input
            placeholder="Category (e.g. Food, Rent, Salary)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={50}
            aria-label="Category"
            className={`${inputClass} w-full`}
            required
          />
          {recentCategories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {recentCategories.slice(0, 6).map((c) => (
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={date}
            max={toInputDate(new Date())}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
            className={`${inputClass} w-full`}
            required
          />
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            aria-label="Note"
            className={`${inputClass} w-full`}
          />
        </div>

        {error && <p className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60"
        >
          {saving ? "Saving…" : `Add ${type}`}
        </button>
      </form>
    </div>
  );
}

export default QuickAddSheet;

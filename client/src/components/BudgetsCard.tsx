import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Pencil, Trash2, Plus, Target, X } from "lucide-react";
import api from "../lib/api";
import { formatINR, inputClass } from "../lib/ui";
import { useToast } from "../lib/toast";
import { announceDataChange } from "../lib/dataEvents";

interface Budget {
  id: string;
  category: string;
  amount: number;
}

interface BudgetsCardProps {
  // Expense transactions for the month being viewed
  expenses: { category: string; amount: number }[];
  monthLabel: string;
  categories: string[];
}

const key = (category: string) => category.trim().toLowerCase();

function BudgetsCard({ expenses, monthLabel, categories }: BudgetsCardProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    api.get("/budgets").then((res) => setBudgets(res.data.budgets)).catch(() => {
      setError("We couldn't load your budgets.");
    });
  }, []);

  // Category names are free text, so match them case-insensitively
  const spentBy: Record<string, number> = {};
  for (const t of expenses) spentBy[key(t.category)] = (spentBy[key(t.category)] || 0) + t.amount;

  const openForm = (budget?: Budget) => {
    setCategory(budget?.category ?? "");
    setAmount(budget ? String(budget.amount) : "");
    setEditing(Boolean(budget));
    setError("");
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.put("/budgets", { category, amount: parseFloat(amount) });
      const saved: Budget = res.data.budget;
      addBudget(saved);
      setFormOpen(false);
      announceDataChange();
      toast({ message: `${saved.category} budget saved` });
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't save that budget. Please try again.");
    }
  };

  const addBudget = (budget: Budget) =>
    setBudgets((current) =>
      [...current.filter((b) => b.id !== budget.id), budget].sort((a, b) => a.category.localeCompare(b.category))
    );

  // Deleting is immediate; Undo sets the same budget again
  const handleDelete = async (budget: Budget) => {
    try {
      await api.delete(`/budgets/${budget.id}`);
      setBudgets((current) => current.filter((b) => b.id !== budget.id));
      announceDataChange();
    } catch {
      setError("We couldn't delete that budget. Please try again.");
      return;
    }
    toast({
      message: `${budget.category} budget deleted`,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            const res = await api.put("/budgets", { category: budget.category, amount: budget.amount });
            addBudget(res.data.budget);
            announceDataChange();
          } catch {
            setError("We couldn't restore that budget. Please add it again.");
          }
        },
      },
    });
  };

  return (
    <section id="budgets" className="bg-surface p-6 rounded-2xl border border-line scroll-mt-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-900">Budgets</h2>
          <p className="text-xs text-ink-500 mt-0.5">Monthly limits · {monthLabel}</p>
        </div>
        {!formOpen && (
          <button
            onClick={() => openForm()}
            className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 transition"
          >
            <Plus size={16} /> Add budget
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-loss text-sm bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}

      {formOpen && (
        <form onSubmit={handleSave} className="mt-4 p-4 bg-canvas rounded-xl border border-line space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-900">{editing ? `Edit ${category} budget` : "New budget"}</p>
            <button type="button" onClick={() => setFormOpen(false)} aria-label="Close" className="text-ink-400 hover:text-ink-900">
              <X size={16} />
            </button>
          </div>
          {!editing && (
            <>
              <input
                list="budget-categories"
                placeholder="Category, e.g. Food"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={50}
                className={`${inputClass} w-full`}
                required
              />
              <datalist id="budget-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500 font-medium">₹</span>
            <input
              type="number"
              min="1"
              placeholder="Monthly limit"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} w-full pl-9 tabular-nums`}
              required
            />
          </div>
          <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition">
            Save budget
          </button>
        </form>
      )}

      {budgets.length === 0 && !formOpen ? (
        <div className="mt-4 flex items-start gap-3 text-sm text-ink-500">
          <Target size={18} className="shrink-0 text-brand-600 mt-0.5" />
          <p>Set a monthly limit for a category, like Food or Shopping, to see how close you are as you spend.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {budgets.map((b) => {
            const spent = spentBy[key(b.category)] || 0;
            const pct = (spent / b.amount) * 100;
            const tone = pct > 100 ? "loss" : pct >= 80 ? "warn" : "ok";
            const barColor = { ok: "bg-brand-500", warn: "bg-warn", loss: "bg-loss" }[tone];
            return (
              <li key={b.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-ink-900 truncate">{b.category}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-ink-500 tabular-nums">
                      <span className="text-ink-900 font-medium">{formatINR(spent)}</span> of {formatINR(b.amount)}
                    </span>
                    <button onClick={() => openForm(b)} aria-label={`Edit ${b.category} budget`} className="text-ink-300 hover:text-brand-600 transition">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(b)} aria-label={`Delete ${b.category} budget`} className="text-ink-300 hover:text-loss transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-ink-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p
                  className={`mt-1 text-xs ${
                    tone === "loss" ? "text-loss" : tone === "warn" ? "text-warn" : "text-ink-500"
                  }`}
                >
                  {tone === "loss"
                    ? `Over by ${formatINR(spent - b.amount)}`
                    : `${formatINR(b.amount - spent)} left${tone === "warn" ? ", getting close" : ""}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default BudgetsCard;

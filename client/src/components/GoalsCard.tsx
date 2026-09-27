import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { Pencil, Trash2, Plus, Flag, X, BookOpen, CheckCircle2 } from "lucide-react";
import api from "../lib/api";
import { formatINR, inputClass } from "../lib/ui";
import { termBySlug } from "../lib/learn";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string | null;
}

// Whole months from this month to the target month (0 = due this month)
const monthsUntil = (iso: string) => {
  const target = new Date(iso);
  const now = new Date();
  return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
};

// Point each goal at the Learn term most likely to help with it
const learnSlugFor = (goal: Goal) => {
  if (/emergency/i.test(goal.name)) return "emergency-fund";
  if (/retire|pension/i.test(goal.name)) return "nps";
  if (/tax/i.test(goal.name)) return "section-80c";
  if (goal.targetDate && monthsUntil(goal.targetDate) < 36) return "fixed-deposit";
  return "sip";
};

const toInputDate = (iso: string) => iso.slice(0, 10);

function GoalsCard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [contributingId, setContributingId] = useState<string | null>(null);
  const [contribution, setContribution] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/goals").then((res) => setGoals(res.data.goals)).catch(() => {
      setError("We couldn't load your goals.");
    });
  }, []);

  const replaceGoal = (goal: Goal) =>
    setGoals((current) => (current.some((g) => g.id === goal.id) ? current.map((g) => (g.id === goal.id ? goal : g)) : [...current, goal]));

  const openForm = (goal?: Goal) => {
    setEditingId(goal?.id ?? null);
    setName(goal?.name ?? "");
    setTarget(goal ? String(goal.targetAmount) : "");
    setTargetDate(goal?.targetDate ? toInputDate(goal.targetDate) : "");
    setError("");
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Midday local time so the chosen date can't shift a day in either direction
    const body = {
      name,
      targetAmount: parseFloat(target),
      targetDate: targetDate ? new Date(`${targetDate}T12:00:00`).toISOString() : null,
    };
    try {
      const res = editingId ? await api.put(`/goals/${editingId}`, body) : await api.post("/goals", body);
      replaceGoal(res.data.goal);
      setFormOpen(false);
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't save that goal. Please try again.");
    }
  };

  const handleContribute = async (id: string, direction: 1 | -1) => {
    const value = parseFloat(contribution);
    if (!value || value <= 0) return;
    setError("");
    try {
      const res = await api.post(`/goals/${id}/contributions`, { amount: value * direction });
      replaceGoal(res.data.goal);
      setContributingId(null);
      setContribution("");
    } catch {
      setError("We couldn't update that goal. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/goals/${id}`);
      setGoals((current) => current.filter((g) => g.id !== id));
    } catch {
      setError("We couldn't delete that goal. Please try again.");
    }
  };

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <section className="bg-surface p-6 rounded-2xl border border-line">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-900">Savings goals</h2>
          <p className="text-xs text-ink-500 mt-0.5">What you're saving towards</p>
        </div>
        {!formOpen && (
          <button
            onClick={() => openForm()}
            className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 transition"
          >
            <Plus size={16} /> Add goal
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-loss text-sm bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}

      {formOpen && (
        <form onSubmit={handleSave} className="mt-4 p-4 bg-canvas rounded-xl border border-line space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-900">{editingId ? "Edit goal" : "New goal"}</p>
            <button type="button" onClick={() => setFormOpen(false)} aria-label="Close" className="text-ink-400 hover:text-ink-900">
              <X size={16} />
            </button>
          </div>
          <input
            placeholder="Goal name, e.g. Emergency fund"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className={`${inputClass} w-full`}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500 font-medium">₹</span>
              <input
                type="number"
                min="1"
                placeholder="Target amount"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={`${inputClass} w-full pl-9 tabular-nums`}
                required
              />
            </div>
            <input
              type="date"
              value={targetDate}
              min={minDate}
              onChange={(e) => setTargetDate(e.target.value)}
              aria-label="Target date (optional)"
              title="Target date (optional)"
              className={`${inputClass} w-full`}
            />
          </div>
          <p className="text-xs text-ink-500">The target date is optional. Add one to see how much to save each month.</p>
          <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition">
            Save goal
          </button>
        </form>
      )}

      {goals.length === 0 && !formOpen ? (
        <div className="mt-4 flex items-start gap-3 text-sm text-ink-500">
          <Flag size={18} className="shrink-0 text-brand-600 mt-0.5" />
          <p>Add something you're saving for, like an emergency fund or a trip, and track your progress here.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-5">
          {goals.map((g) => {
            const pct = Math.min((g.savedAmount / g.targetAmount) * 100, 100);
            const remaining = Math.max(g.targetAmount - g.savedAmount, 0);
            const reached = remaining === 0;
            const learn = termBySlug(learnSlugFor(g));

            let pace = "";
            if (!reached && g.targetDate) {
              const months = monthsUntil(g.targetDate);
              const dateLabel = new Date(g.targetDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
              if (new Date(g.targetDate).setHours(23, 59, 59, 999) < today.getTime()) pace = `Target date (${dateLabel}) has passed`;
              else if (months <= 0) pace = `${formatINR(remaining)} still needed this month`;
              else pace = `Save about ${formatINR(Math.ceil(remaining / months))} a month to reach it by ${dateLabel}`;
            }

            return (
              <li key={g.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-ink-900 truncate flex items-center gap-1.5">
                    {reached && <CheckCircle2 size={16} className="text-gain shrink-0" />}
                    {g.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-ink-500 tabular-nums">
                      <span className="text-ink-900 font-medium">{formatINR(g.savedAmount)}</span> of {formatINR(g.targetAmount)}
                    </span>
                    <button onClick={() => openForm(g)} aria-label={`Edit ${g.name}`} className="text-ink-300 hover:text-brand-600 transition">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(g.id)} aria-label={`Delete ${g.name}`} className="text-ink-300 hover:text-loss transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-ink-100 overflow-hidden">
                  <div className={`h-full rounded-full ${reached ? "bg-gain" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`mt-1 text-xs ${reached ? "text-gain font-medium" : "text-ink-500"}`}>
                  {reached ? "Goal reached" : pace || `${formatINR(remaining)} to go`}
                </p>

                {contributingId === g.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Amount"
                      value={contribution}
                      onChange={(e) => setContribution(e.target.value)}
                      className={`${inputClass} py-1.5 text-sm w-32 tabular-nums`}
                      autoFocus
                    />
                    <button onClick={() => handleContribute(g.id, 1)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition">
                      Add
                    </button>
                    <button onClick={() => handleContribute(g.id, -1)} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-700 hover:bg-ink-100 transition">
                      Withdraw
                    </button>
                    <button onClick={() => setContributingId(null)} aria-label="Cancel" className="text-ink-400 hover:text-ink-900">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <button
                      onClick={() => {
                        setContributingId(g.id);
                        setContribution("");
                      }}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      Add money
                    </button>
                    {learn && (
                      <Link to={`/learn/${learn.slug}`} className="flex items-center gap-1 text-ink-500 hover:text-ink-900">
                        <BookOpen size={12} /> Learn: {learn.term}
                      </Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default GoalsCard;

import { useState } from "react";
import { isAxiosError } from "axios";
import { GitMerge, Pencil, Plus, Trash2 } from "lucide-react";
import api from "../lib/api";
import { inputClass } from "../lib/ui";
import { useToast } from "../lib/toast";
import { announceDataChange } from "../lib/dataEvents";
import { useCategories, usageSummary } from "../lib/categories";
import type { Category } from "../lib/categories";

type Mode = { kind: "rename"; id: string; name: string } | { kind: "merge"; id: string; intoId: string } | { kind: "delete"; id: string };

const errorMessage = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

const smallButton = "px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60";
const primary = `${smallButton} bg-brand-600 text-white hover:bg-brand-700`;
const quiet = `${smallButton} text-ink-500 hover:text-ink-900`;

// Settings: add, rename, merge and delete the categories used across the app
function CategoriesCard() {
  const { categories, loaded, failed, reload } = useCategories();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [mode, setMode] = useState<Mode | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  const shown = categories.filter((c) => c.type === type);

  // Refreshes this card (through useCategories) and anything else on screen that shows categories
  const done = async (message: string) => {
    setMode(null);
    setError("");
    announceDataChange();
    toast({ message });
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      try {
        await api.post("/categories", { name, type });
        setNewName("");
        await done(`${name} added`);
      } catch (err) {
        setError(errorMessage(err, "We couldn't add that category."));
      }
    });
  };

  const rename = (c: Category, name: string) =>
    run(async () => {
      try {
        await api.patch(`/categories/${c.id}`, { name: name.trim() });
        await done(`Renamed to ${name.trim()}`);
      } catch (err) {
        // Renaming onto an existing category: offer to merge into it instead
        const existing = shown.find((o) => o.id !== c.id && o.name.toLowerCase() === name.trim().toLowerCase());
        if (isAxiosError(err) && err.response?.status === 409 && existing) {
          setMode({ kind: "merge", id: c.id, intoId: existing.id });
          setError(`You already have ${existing.name}. Merge ${c.name} into it instead?`);
        } else {
          setError(errorMessage(err, "We couldn't rename that category."));
        }
      }
    });

  const merge = (c: Category, intoId: string) =>
    run(async () => {
      const into = shown.find((o) => o.id === intoId);
      try {
        await api.post(`/categories/${c.id}/merge`, { intoId });
        await done(`${c.name} merged into ${into?.name ?? "the other category"}`);
      } catch (err) {
        setError(errorMessage(err, "We couldn't merge those categories."));
      }
    });

  const remove = (c: Category) =>
    run(async () => {
      try {
        await api.delete(`/categories/${c.id}`);
        await done(`${c.name} deleted`);
      } catch (err) {
        setError(errorMessage(err, "We couldn't delete that category."));
      }
    });

  const row = (c: Category) => {
    const usage = usageSummary(c);
    const active = mode?.id === c.id ? mode : null;

    if (active?.kind === "rename") {
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (active.name.trim()) rename(c, active.name);
          }}
          className="flex flex-wrap items-center gap-2 py-2.5"
        >
          <input
            value={active.name}
            onChange={(e) => setMode({ ...active, name: e.target.value })}
            maxLength={50}
            aria-label={`New name for ${c.name}`}
            autoFocus
            className={`${inputClass} flex-1 min-w-40 py-1.5 text-sm`}
          />
          <button type="submit" disabled={busy || !active.name.trim()} className={primary}>
            Save
          </button>
          <button type="button" onClick={() => setMode(null)} className={quiet}>
            Cancel
          </button>
          {usage && <p className="w-full text-xs text-ink-500">Past entries using {c.name} will be renamed too.</p>}
        </form>
      );
    }

    if (active?.kind === "merge") {
      const into = shown.find((o) => o.id === active.intoId);
      return (
        <div className="py-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-700">
              Merge <span className="font-medium text-ink-900">{c.name}</span> into
            </span>
            <select
              value={active.intoId}
              onChange={(e) => setMode({ ...active, intoId: e.target.value })}
              aria-label={`Category to merge ${c.name} into`}
              className={`${inputClass} py-1.5 text-sm`}
            >
              <option value="">Choose…</option>
              {shown
                .filter((o) => o.id !== c.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
            </select>
            <button onClick={() => merge(c, active.intoId)} disabled={busy || !active.intoId} className={primary}>
              Merge
            </button>
            <button onClick={() => { setMode(null); setError(""); }} className={quiet}>
              Cancel
            </button>
          </div>
          {into && (
            <p className="text-xs text-ink-500">
              {usage ? `Moves ${usage} to ${into.name}` : `Nothing uses ${c.name} yet`}, then removes {c.name}. This can't be undone.
              {c.hasBudget && into.hasBudget && ` ${into.name}'s budget is kept.`}
            </p>
          )}
        </div>
      );
    }

    if (active?.kind === "delete") {
      return (
        <div className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
          <span className="flex-1 text-ink-700">
            Delete <span className="font-medium text-ink-900">{c.name}</span>?
          </span>
          <button onClick={() => remove(c)} disabled={busy} className={`${smallButton} text-loss hover:bg-loss-soft`}>
            Delete
          </button>
          <button onClick={() => setMode(null)} className={quiet}>
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 py-2.5 group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-900 truncate">{c.name}</p>
          <p className="text-xs text-ink-500">{usage ?? "Not used yet"}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => { setError(""); setMode({ kind: "rename", id: c.id, name: c.name }); }}
            aria-label={`Rename ${c.name}`}
            title="Rename"
            className="text-ink-300 hover:text-brand-600 transition"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => { setError(""); setMode({ kind: "merge", id: c.id, intoId: "" }); }}
            disabled={shown.length < 2}
            aria-label={`Merge ${c.name} into another category`}
            title="Merge into another category"
            className="text-ink-300 hover:text-brand-600 transition disabled:opacity-40 disabled:hover:text-ink-300"
          >
            <GitMerge size={16} />
          </button>
          <button
            onClick={() => { setError(""); setMode({ kind: "delete", id: c.id }); }}
            disabled={Boolean(usage)}
            aria-label={`Delete ${c.name}`}
            title={usage ? "In use. Merge it into another category instead." : "Delete"}
            className="text-ink-300 hover:text-loss transition disabled:opacity-40 disabled:hover:text-ink-300 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <h2 className="font-semibold text-ink-900">Categories</h2>
      <p className="mt-1 text-sm text-ink-500">
        Offered when you add a transaction. Renaming or merging also updates your past entries, budgets and recurring
        transactions.
      </p>

      <div className="mt-5 space-y-4">
        <div role="tablist" aria-label="Category type" className="grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={type === t}
              onClick={() => { setType(t); setMode(null); setError(""); }}
              className={`py-2 rounded-lg transition ${type === t ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
            >
              {t === "expense" ? "Expenses" : "Income"}
              {loaded && <span className="ml-1.5 text-ink-400">{categories.filter((c) => c.type === t).length}</span>}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}

        {!loaded ? (
          <div className="space-y-2 animate-pulse" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-10 bg-ink-100 rounded-lg" />)}
          </div>
        ) : failed ? (
          <p className="text-sm text-loss">
            We couldn't load your categories.{" "}
            <button onClick={reload} className="font-medium underline underline-offset-2 hover:no-underline">Try again</button>
          </p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-ink-500">No {type} categories yet. Add one below.</p>
        ) : (
          <ul className="divide-y divide-line max-h-[32rem] overflow-y-auto -mx-1 px-1">
            {shown.map((c) => <li key={c.id}>{row(c)}</li>)}
          </ul>
        )}

        <form onSubmit={add} className="flex gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={50}
            placeholder={type === "expense" ? "New expense category, e.g. Chai" : "New income category, e.g. Interest"}
            aria-label={`New ${type} category`}
            className={`${inputClass} flex-1 min-w-0 py-2 text-sm`}
          />
          <button type="submit" disabled={busy || !newName.trim()} className={`${primary} flex items-center gap-1.5 py-2`}>
            <Plus size={16} /> Add
          </button>
        </form>
      </div>
    </section>
  );
}

export default CategoriesCard;

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { AlertTriangle, ArrowLeft, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import { formatINR, inputClass, pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { announceDataChange } from "../lib/dataEvents";
import { ITEM_TYPES, signedINR, typeLabel } from "../lib/networth";
import { accountName, isAccount, withAccountAlert } from "../lib/accounts";
import type { ItemKind, NetWorthItem, NetWorthOverview } from "../lib/networth";
import type { AccountAlert } from "../lib/accounts";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};
const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

const primaryButton =
  "bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed";

function KindChoice({ value, onChange }: { value: ItemKind; onChange: (kind: ItemKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Own or owe" className="grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium">
      {(
        [
          { kind: "asset", label: "Something I own" },
          { kind: "liability", label: "Something I owe" },
        ] as const
      ).map((o) => (
        <button
          key={o.kind}
          type="button"
          role="radio"
          aria-checked={value === o.kind}
          onClick={() => onChange(o.kind)}
          className={`py-2 rounded-lg transition ${value === o.kind ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// How much of a card's limit is used, as a bar that turns amber at 80% and red past the limit
function LimitBar({ owed, limit }: { owed: number; limit: number }) {
  const used = owed / limit;
  const colour = used > 1 ? "bg-loss" : used >= 0.8 ? "bg-warn" : "bg-brand-500";
  return (
    <div className="mt-1.5 max-w-60">
      <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${Math.min(100, Math.max(0, used * 100))}%` }} />
      </div>
      <p className={`mt-1 text-xs ${used > 1 ? "text-loss font-medium" : "text-ink-500"}`}>
        {used > 1 ? `${formatINR(owed - limit)} over the ${formatINR(limit)} limit` : `${formatINR(owed)} of ${formatINR(limit)} limit used`}
      </p>
    </div>
  );
}

// One item: its value, a quick way to update it, and its past values. `accounts` are the user's
// other accounts, for moving money into this one.
function ItemRow({ item, accounts, onChanged }: { item: NetWorthItem; accounts: NetWorthItem[]; onChanged: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"view" | "value" | "edit" | "remove" | "move">("view");
  const [creditLimit, setCreditLimit] = useState("");
  const sources = accounts.filter((a) => a.id !== item.id && a.kind === "asset").sort((a, b) => b.value - a.value);
  const [moveFrom, setMoveFrom] = useState("");
  const [moveAmount, setMoveAmount] = useState("");
  const overdrawn = item.isAccount && item.kind === "asset" && item.value < 0;
  // Moving money in: covering a shortfall, or paying a card's bill
  const startMove = (amount: number) => {
    setMoveFrom(sources[0]?.id ?? "");
    setMoveAmount(String(Math.round(amount * 100) / 100));
    setError("");
    setMode("move");
  };
  const [value, setValue] = useState("");
  const [name, setName] = useState(item.name);
  const [type, setType] = useState(item.type);
  const [history, setHistory] = useState<{ id: string; value: number; recordedAt: string }[] | null>(null);
  const [error, setError] = useState("");

  const run = async (task: () => Promise<unknown>, done: string) => {
    setError("");
    try {
      // A transfer can leave the account it came from below zero, which the toast mentions
      const alert = await task();
      setMode("view");
      setHistory(null);
      onChanged();
      toast({ message: withAccountAlert(done, alert && typeof alert === "object" && "kind" in alert ? (alert as AccountAlert) : null) });
    } catch (err) {
      setError(errorText(err, "We couldn't save that. Please try again."));
    }
  };

  const toggleHistory = () => {
    if (history) return setHistory(null);
    api
      .get(`/networth/items/${item.id}/values`)
      .then((res) => setHistory(res.data.values))
      .catch(() => setError("We couldn't load the past values."));
  };

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink-900 truncate flex items-center gap-2">
            <span className="truncate">{item.name}</span>
            {item.isDefault && (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">Default</span>
            )}
          </p>
          <p className="text-xs text-ink-500">
            {typeLabel(item.kind, item.type)} · {item.isAccount ? "balance typed in" : "updated"} {shortDate(item.updatedAt)}
          </p>
          {item.tracked && item.tracked.change !== 0 && (
            <p className="text-xs text-ink-500">
              {formatINR(item.tracked.recorded)} typed in, {signedINR(item.tracked.change)} from your Tracker since
            </p>
          )}
        </div>
        <p
          className={`shrink-0 font-semibold tabular-nums ${overdrawn ? "text-loss" : item.kind === "liability" ? "text-ink-700" : "text-ink-900"}`}
        >
          {formatINR(item.value)}
        </p>
      </div>
      {item.type === "credit_card" && item.creditLimit && <LimitBar owed={item.value} limit={item.creditLimit} />}

      {overdrawn && mode !== "move" && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-loss-soft px-3 py-2.5 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-loss" />
          <p className="flex-1 text-ink-700">
            You've spent {formatINR(-item.value)} more than {item.name} held.{" "}
            {sources.length > 0 ? "Move money in from another account to cover it." : "Update its balance if your bank shows something else."}
          </p>
          {sources.length > 0 && (
            <button onClick={() => startMove(-item.value)} className="shrink-0 font-medium text-brand-700 hover:underline">
              Move money
            </button>
          )}
        </div>
      )}

      {mode === "move" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const from = sources.find((a) => a.id === moveFrom);
            run(async () => {
              const res = await api.post("/transfers", { fromId: moveFrom, toId: item.id, amount: moveAmount });
              return res.data.accountAlert;
            }, `${formatINR(Number(moveAmount))} moved from ${from?.name ?? "your account"} to ${item.name}`);
          }}
          className="mt-3 rounded-xl bg-canvas border border-line p-3 text-sm space-y-2"
        >
          <p className="text-ink-700">
            {item.kind === "liability" ? `Pay ${item.name}'s bill from` : `Move money into ${item.name} from`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={moveFrom} onChange={(e) => setMoveFrom(e.target.value)} aria-label="From" className={`${inputClass} py-1.5 text-sm`}>
              {sources.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountName(a)} ({formatINR(a.value)})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={moveAmount}
              onChange={(e) => setMoveAmount(e.target.value)}
              aria-label="Amount"
              className={`${inputClass} py-1.5 text-sm w-36 tabular-nums`}
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition">
              {item.kind === "liability" ? "Pay" : "Move"}
            </button>
            <button type="button" onClick={() => setMode("view")} aria-label="Cancel" className="text-ink-400 hover:text-ink-900">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-ink-500">It's recorded as a transfer, so it isn't counted as spending or income.</p>
        </form>
      )}

      {mode === "value" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.post(`/networth/items/${item.id}/values`, { value }), `${item.name} updated`);
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="number"
            min="0"
            step="any"
            autoFocus
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={item.isAccount ? (item.kind === "asset" ? "Balance now" : "What you owe on it now") : item.kind === "asset" ? "What it's worth now" : "What you owe now"}
            aria-label="New value"
            className={`${inputClass} py-1.5 text-sm w-48 tabular-nums`}
          />
          <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition">
            Save
          </button>
          <button type="button" onClick={() => setMode("view")} aria-label="Cancel" className="text-ink-400 hover:text-ink-900">
            <X size={16} />
          </button>
        </form>
      )}

      {mode === "edit" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                api.put(`/networth/items/${item.id}`, {
                  name,
                  type,
                  kind: item.kind,
                  ...(type === "credit_card" && { creditLimit: creditLimit === "" ? null : creditLimit }),
                }),
              "Saved"
            );
          }}
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] items-center"
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required aria-label="Name" className={`${inputClass} py-1.5 text-sm`} />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" className={`${inputClass} py-1.5 text-sm`}>
            {ITEM_TYPES[item.kind].map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {type === "credit_card" && (
            <input
              type="number"
              min="1"
              step="any"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="Credit limit (optional)"
              aria-label="Credit limit"
              className={`${inputClass} py-1.5 text-sm tabular-nums sm:col-span-2`}
            />
          )}
          <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition">
            Save
          </button>
          <button type="button" onClick={() => setMode("view")} aria-label="Cancel" className="text-ink-400 hover:text-ink-900 justify-self-start">
            <X size={16} />
          </button>
        </form>
      )}

      {mode === "remove" && (
        <div className="mt-3 rounded-xl bg-canvas border border-line p-3 text-sm">
          <p className="text-ink-700">
            Remove {item.name}? It counts as {formatINR(0)} from today. Your net worth on earlier dates stays the same.
          </p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => run(() => api.delete(`/networth/items/${item.id}`), `${item.name} removed`)} className="font-medium text-loss hover:underline">
              Remove
            </button>
            <button onClick={() => setMode("view")} className="text-ink-500 hover:text-ink-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "view" && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <button
            onClick={() => {
              setValue("");
              setMode("value");
            }}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Update value
          </button>
          <button onClick={toggleHistory} aria-expanded={history !== null} className="text-ink-500 hover:text-ink-900">
            {history ? "Hide history" : "History"}
          </button>
          {item.type === "credit_card" && item.value > 0 && sources.length > 0 && (
            <button onClick={() => startMove(item.value)} className="text-ink-500 hover:text-ink-900">
              Pay bill
            </button>
          )}
          {item.isAccount && !item.isDefault && (
            <button
              onClick={() => run(() => api.put(`/networth/items/${item.id}/default`, { isDefault: true }), `New entries will start with ${item.name}`)}
              className="text-ink-500 hover:text-ink-900"
            >
              Make default
            </button>
          )}
          <button
            onClick={() => {
              setName(item.name);
              setType(item.type);
              setCreditLimit(item.creditLimit ? String(item.creditLimit) : "");
              setMode("edit");
            }}
            aria-label={`Edit ${item.name}`}
            className="text-ink-300 hover:text-brand-600 transition"
          >
            <Pencil size={13} />
          </button>
          <button onClick={() => setMode("remove")} aria-label={`Remove ${item.name}`} className="text-ink-300 hover:text-loss transition">
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {history && (
        <ul className="mt-3 rounded-xl bg-canvas border border-line px-4 py-3 space-y-1.5 text-xs">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between gap-3">
              <span className="text-ink-500">{shortDate(h.recordedAt)}</span>
              <span className="font-medium tabular-nums text-ink-700">{formatINR(h.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-loss">{error}</p>}
    </li>
  );
}

export default function NetWorth() {
  useTitle("Net worth");
  const wide = useWideLayout();
  const toast = useToast();
  const [data, setData] = useState<NetWorthOverview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [kind, setKind] = useState<ItemKind>("asset");
  const [type, setType] = useState("bank");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [asDefault, setAsDefault] = useState(false);
  const [newLimit, setNewLimit] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(() => {
    api
      .get("/networth", { params: { tzOffset: new Date().getTimezoneOffset() } })
      .then((res) => {
        setData(res.data);
        setLoadError("");
      })
      .catch(() => setLoadError("We couldn't load your net worth. Please try again."));
  }, []);

  useEffect(load, [load]);

  const changed = () => {
    load();
    announceDataChange();
  };

  const chooseKind = (next: ItemKind) => {
    setKind(next);
    setType(ITEM_TYPES[next][0].value);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setFormError("");
    try {
      const res = await api.post("/networth/items", {
        kind,
        type,
        name,
        value,
        isDefault: account && asDefault,
        ...(type === "credit_card" && newLimit !== "" && { creditLimit: newLimit }),
      });
      toast({ message: res.data.item.isDefault ? `${name.trim()} added as your default account` : `${name.trim()} added` });
      setAsDefault(false);
      setNewLimit("");
      setName("");
      setValue("");
      changed();
    } catch (err) {
      setFormError(errorText(err, "We couldn't add that. Please try again."));
    } finally {
      setAdding(false);
    }
  };

  const account = isAccount(kind, type);
  const currentDefault = data?.items.find((i) => i.isDefault);

  const header = (
    <div className="space-y-4">
      <Link to="/tracker" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
        <ArrowLeft size={16} /> Tracker
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Net worth</h1>
        <p className="mt-1 text-sm text-ink-500">
          What you own minus what you owe. Bank accounts, cash and credit cards move with what you add in the Tracker; update the other
          values whenever they change.
        </p>
      </div>
    </div>
  );

  if (loadError) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`}>
        {header}
        <div role="alert" className="flex items-center gap-3 bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
          <span className="flex-1">{loadError}</span>
          <button onClick={load} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`} aria-busy="true">
        {header}
        <div className="h-44 rounded-2xl bg-ink-100 animate-pulse" />
      </main>
    );
  }

  const assets = data.items.filter((i) => i.kind === "asset");
  const liabilities = data.items.filter((i) => i.kind === "liability");
  const empty = data.items.length === 0;

  const addForm = (
    <form onSubmit={add} className="bg-surface border border-line rounded-2xl p-6 space-y-4">
      <h2 className="font-semibold text-ink-900">{empty ? "Add your first item" : "Add an item"}</h2>
      <KindChoice value={kind} onChange={chooseKind} />
      <label className="block text-sm font-medium text-ink-700">
        Type
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputClass} w-full mt-1 font-normal`}>
          {ITEM_TYPES[kind].map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-ink-700">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          placeholder={kind === "asset" ? "e.g. HDFC savings, Gold coins" : "e.g. Car loan, Amazon Pay card"}
          className={`${inputClass} w-full mt-1 font-normal`}
        />
      </label>
      <label className="block text-sm font-medium text-ink-700">
        {kind === "asset" ? "What it's worth today" : "What you owe today"}
        <div className="relative mt-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 font-normal">₹</span>
          <input
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            className={`${inputClass} w-full !pl-8 font-normal tabular-nums`}
          />
        </div>
      </label>
      {type === "credit_card" && (
        <label className="block text-sm font-medium text-ink-700">
          Credit limit <span className="font-normal text-ink-500">(optional)</span>
          <div className="relative mt-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 font-normal">₹</span>
            <input
              type="number"
              min="1"
              step="any"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              className={`${inputClass} w-full !pl-8 font-normal tabular-nums`}
            />
          </div>
          <span className="mt-1 block text-xs font-normal text-ink-500">We'll tell you when you've used 80% of it.</span>
        </label>
      )}
      {account && (
        <p className="text-xs text-ink-500">
          {kind === "asset"
            ? "Income you add in the Tracker for this account raises its balance, and spending lowers it."
            : "Spending on this card in the Tracker adds to what you owe, and refunds lower it."}
        </p>
      )}
      {account && currentDefault && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={asDefault} onChange={(e) => setAsDefault(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand-600" />
          <span className="text-sm text-ink-900">
            Make this my default account
            <span className="block text-xs text-ink-500">New Tracker entries will start with it, instead of {currentDefault.name}.</span>
          </span>
        </label>
      )}
      {formError && <p role="alert" className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{formError}</p>}
      <button type="submit" disabled={adding} className={`${primaryButton} inline-flex items-center gap-2`}>
        <Plus size={16} /> {adding ? "Adding…" : "Add"}
      </button>
      <p className="flex items-start gap-2 text-xs text-ink-500">
        <Lock size={13} className="shrink-0 mt-0.5" /> Only you can see this. It never appears on your profile or in Discuss.
      </p>
    </form>
  );

  const headline = (
    <section className="dark-panel bg-ink-900 rounded-2xl p-6 sm:p-8 text-white lg:flex lg:items-end lg:justify-between lg:gap-10">
      <div>
        <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">Your net worth</p>
        <p className={`mt-2 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums ${data.totals.netWorth < 0 ? "text-loss" : ""}`}>
          {data.totals.netWorth < 0 ? "−" : ""}
          {formatINR(Math.abs(data.totals.netWorth))}
        </p>
        <p className="mt-2 text-sm text-ink-300">
          {data.changeThisMonth !== null && data.changeThisMonth !== 0 && (
            <span className={data.changeThisMonth > 0 ? "text-brand-300" : ""}>{signedINR(data.changeThisMonth)} in the last 30 days · </span>
          )}
          {data.lastUpdated ? `Last updated ${shortDate(data.lastUpdated)}` : "Nothing added yet"}
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-ink-800 pt-5 lg:mt-0 lg:shrink-0 lg:gap-10 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-10">
        <div>
          <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">You own</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatINR(data.totals.assets)}</p>
        </div>
        <div>
          <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">You owe</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatINR(data.totals.liabilities)}</p>
        </div>
      </div>
    </section>
  );

  const chart = data.history.length >= 2 && (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <h2 className="font-semibold text-ink-900">Over time</h2>
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.history.map((h) => ({ ...h, label: monthLabel(h.month) }))} margin={{ left: 0, right: 8 }}>
            <defs>
              <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-500)", fontSize: 12 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={60}
              tick={{ fill: "var(--color-ink-500)", fontSize: 12 }}
              tickFormatter={(v) => (Number(v) < 0 ? "−₹" : "₹") + Math.abs(Number(v)).toLocaleString("en-IN", { notation: "compact" })}
            />
            <Tooltip cursor={{ stroke: "var(--color-ink-300)" }} formatter={(v) => formatINR(Number(v))} />
            <Area type="monotone" dataKey="netWorth" name="Net worth" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#netWorthFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );

  const list = (title: string, items: NetWorthItem[], total: number, emptyText: string) => (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-ink-900">{title}</h2>
        <span className="text-sm font-medium tabular-nums text-ink-700">{formatINR(total)}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">{emptyText}</p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {items.map((i) => (
            <ItemRow key={i.id} item={i} accounts={data.items.filter((a) => a.isAccount)} onChanged={changed} />
          ))}
        </ul>
      )}
    </section>
  );

  const lists = (
    <div className="grid gap-6 md:grid-cols-2 items-start">
      {list("What you own", assets, data.totals.assets, "Bank accounts, FDs, mutual funds, PF, gold and property all count.")}
      {list("What you owe", liabilities, data.totals.liabilities, "Loans, credit card balances and money borrowed from someone.")}
    </div>
  );

  const intro = empty && (
    <section className="bg-surface border border-line rounded-2xl p-6 text-sm text-ink-700 leading-relaxed">
      <h2 className="font-semibold text-ink-900">Why track net worth?</h2>
      <p className="mt-2">
        Your monthly numbers show money moving. Net worth shows where you stand overall: add up what you own, take away what you owe.
        Watching it grow, even slowly, is one of the best signs your money habits are working.
      </p>
      <p className="mt-2">Start with your main bank account and any loan. You can add the rest later.</p>
    </section>
  );

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      {header}
      {wide ? (
        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            {headline}
            {intro}
            {chart}
            {!empty && lists}
          </div>
          <aside className="sticky top-20">{addForm}</aside>
        </div>
      ) : (
        <>
          {headline}
          {intro}
          {!empty && lists}
          {addForm}
          {chart}
        </>
      )}
    </main>
  );
}

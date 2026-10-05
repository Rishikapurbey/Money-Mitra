import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import { formatINR, inputClass, pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { announceDataChange } from "../lib/dataEvents";
import { ITEM_TYPES, MAIN_ACCOUNT_TYPES, signedINR, typeLabel } from "../lib/networth";
import type { ItemKind, NetWorthItem, NetWorthOverview } from "../lib/networth";

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

// One item: its value, a quick way to update it, and its past values
function ItemRow({ item, onChanged }: { item: NetWorthItem; onChanged: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"view" | "value" | "edit" | "remove" | "main">("view");
  const [value, setValue] = useState("");
  const [name, setName] = useState(item.name);
  const [type, setType] = useState(item.type);
  const [history, setHistory] = useState<{ id: string; value: number; recordedAt: string }[] | null>(null);
  const [error, setError] = useState("");

  const run = async (task: () => Promise<unknown>, done: string) => {
    setError("");
    try {
      await task();
      setMode("view");
      setHistory(null);
      onChanged();
      toast({ message: done });
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
            {item.isMain && (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">Main account</span>
            )}
          </p>
          <p className="text-xs text-ink-500">
            {typeLabel(item.kind, item.type)} · updated {shortDate(item.updatedAt)}
          </p>
          {item.tracked && item.tracked.change !== 0 && (
            <p className="text-xs text-ink-500">
              {formatINR(item.tracked.recorded)} on {shortDate(item.updatedAt)}, then {signedINR(item.tracked.change)} from your Tracker
            </p>
          )}
        </div>
        <p className={`shrink-0 font-semibold tabular-nums ${item.kind === "liability" ? "text-ink-700" : "text-ink-900"}`}>
          {formatINR(item.value)}
        </p>
      </div>

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
            placeholder={item.kind === "asset" ? "What it's worth now" : "What you owe now"}
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
            run(() => api.put(`/networth/items/${item.id}`, { name, type, kind: item.kind }), "Saved");
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
          <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition">
            Save
          </button>
          <button type="button" onClick={() => setMode("view")} aria-label="Cancel" className="text-ink-400 hover:text-ink-900 justify-self-start">
            <X size={16} />
          </button>
        </form>
      )}

      {mode === "main" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (value !== "") await api.post(`/networth/items/${item.id}/values`, { value });
              await api.put(`/networth/items/${item.id}/main`, { isMain: true });
            }, `${item.name} is now your main account`);
          }}
          className="mt-3 rounded-xl bg-canvas border border-line p-3 text-sm space-y-2"
        >
          <p className="text-ink-700">
            Tracker income and expenses dated from now on will change this balance. Type in what's in it today, so it starts from the right
            amount.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Today's balance (now ${formatINR(item.value)})`}
              aria-label="Today's balance"
              className={`${inputClass} py-1.5 text-sm w-60 tabular-nums`}
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition">
              {value === "" ? "Keep the value and continue" : "Save"}
            </button>
            <button type="button" onClick={() => setMode("view")} aria-label="Cancel" className="text-ink-400 hover:text-ink-900">
              <X size={16} />
            </button>
          </div>
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
          {item.isMain ? (
            <button
              onClick={() => run(() => api.put(`/networth/items/${item.id}/main`, { isMain: false }), `${item.name} is no longer your main account`)}
              className="text-ink-500 hover:text-ink-900"
            >
              Stop using as main account
            </button>
          ) : (
            item.kind === "asset" &&
            MAIN_ACCOUNT_TYPES.includes(item.type) && (
              <button
                onClick={() => {
                  setValue("");
                  setMode("main");
                }}
                className="text-ink-500 hover:text-ink-900"
              >
                Make main account
              </button>
            )
          )}
          <button
            onClick={() => {
              setName(item.name);
              setType(item.type);
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
  const [asMain, setAsMain] = useState(false);
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
      const res = await api.post("/networth/items", { kind, type, name, value });
      if (canBeMain && asMain) await api.put(`/networth/items/${res.data.item.id}/main`, { isMain: true });
      toast({ message: canBeMain && asMain ? `${name.trim()} added as your main account` : `${name.trim()} added` });
      setAsMain(false);
      setName("");
      setValue("");
      changed();
    } catch (err) {
      setFormError(errorText(err, "We couldn't add that. Please try again."));
    } finally {
      setAdding(false);
    }
  };

  const canBeMain = kind === "asset" && MAIN_ACCOUNT_TYPES.includes(type);
  const currentMain = data?.items.find((i) => i.isMain);

  const header = (
    <div className="space-y-4">
      <Link to="/tracker" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
        <ArrowLeft size={16} /> Tracker
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Net worth</h1>
        <p className="mt-1 text-sm text-ink-500">
          What you own minus what you owe. Your main account moves with your Tracker; update the other values whenever they change.
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
      {canBeMain && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={asMain} onChange={(e) => setAsMain(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand-600" />
          <span className="text-sm text-ink-900">
            Make this my main account
            <span className="block text-xs text-ink-500">
              Tracker income and expenses from now on will change its balance
              {currentMain ? `, instead of ${currentMain.name}` : ""}.
            </span>
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
            <ItemRow key={i.id} item={i} onChanged={changed} />
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

import { useEffect, useRef, useState } from "react";
import { useNavigationType, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, ArrowRight, Pencil, Receipt, Repeat, Search, SlidersHorizontal, Trash2, UsersRound, X } from "lucide-react";
import ActionMenu from "./ActionMenu";
import type { MenuAction } from "./ActionMenu";
import api from "../lib/api";
import { formatINR, inputClass } from "../lib/ui";
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  matchesFilters,
  searchQuery,
  totalsOf,
} from "../lib/transactionFilters";
import type { RangeKey, TransactionFilters } from "../lib/transactionFilters";
import { accountName } from "../lib/accounts";
import type { Account, Transfer } from "../lib/accounts";

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  note?: string;
  date: string;
  recurringId?: string | null;
  // Set when this is the user's share of a shared group expense
  shareId?: string | null;
  // The account it was paid from or received in
  accountId?: string | null;
}

interface Totals {
  count: number;
  income: number;
  expense: number;
}

interface SearchResults {
  key: string;
  transactions: Transaction[];
  totals: Totals;
  nextCursor: string | null;
}

interface TransactionsCardProps {
  // The month picked at the top of the Tracker, already loaded
  month: Date;
  monthTransactions: Transaction[];
  isCurrentMonth: boolean;
  wide: boolean;
  colorFor: (category: string) => string;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  accounts: Account[];
  // The month's transfers between the user's own accounts
  monthTransfers: Transfer[];
  onEditTransfer: (t: Transfer) => void;
  onDeleteTransfer: (t: Transfer) => void;
}

// A line in the list: an income or expense, or a transfer
type Row = { kind: "entry"; item: Transaction } | { kind: "transfer"; item: Transfer };

const monthName = (d: Date) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const shortDate = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  // The year only when it isn't this one
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" }) });
};

const RANGE_LABELS: Record<Exclude<RangeKey, "month">, string> = {
  "3m": "Last 3 months",
  year: "This year",
  all: "All time",
  custom: "Custom dates",
};

function customRangeLabel(from: string, to: string) {
  if (from && to) return `${shortDate(from)} – ${shortDate(to)}`;
  if (from) return `From ${shortDate(from)}`;
  if (to) return `Until ${shortDate(to)}`;
  return "Custom dates";
}

// Removable summaries of the filters that are set
function activeChips(
  filters: TransactionFilters,
  nameOfAccount: (id: string) => string,
): { label: string; clear: Partial<TransactionFilters> }[] {
  const chips: { label: string; clear: Partial<TransactionFilters> }[] = [];
  if (filters.q.trim()) chips.push({ label: `“${filters.q.trim()}”`, clear: { q: "" } });
  if (filters.type !== "all") chips.push({ label: filters.type === "income" ? "Income" : "Expenses", clear: { type: "all" } });
  if (filters.category !== "all") chips.push({ label: filters.category, clear: { category: "all" } });
  if (filters.account !== "all") chips.push({ label: nameOfAccount(filters.account), clear: { account: "all" } });
  if (filters.min) chips.push({ label: `Min ${formatINR(Number(filters.min) || 0)}`, clear: { min: "" } });
  if (filters.max) chips.push({ label: `Max ${formatINR(Number(filters.max) || 0)}`, clear: { max: "" } });
  if (filters.range !== "month") {
    chips.push({
      label: filters.range === "custom" ? customRangeLabel(filters.from, filters.to) : RANGE_LABELS[filters.range],
      clear: { range: "month", from: "", to: "" },
    });
  }
  return chips;
}

function TransactionsCard({
  month,
  monthTransactions,
  isCurrentMonth,
  wide,
  colorFor,
  onEdit,
  onDelete,
  accounts,
  monthTransfers,
  onEditTransfer,
  onDeleteTransfer,
}: TransactionsCardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  // The filters are kept here and copied to the URL. Reading them back from the URL on every keystroke
  // would lose letters, because the URL updates a moment after the input.
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const urlKey = searchParams.toString();
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (urlKey !== seenUrl) {
    setSeenUrl(urlKey);
    // Our own updates replace the URL; a link or the back button means the filters should follow it
    if (navigationType !== "REPLACE") setFilters(filtersFromParams(searchParams));
  }
  const filtering = hasActiveFilters(filters);
  // The selected month is already loaded, so it is filtered here; other ranges are searched on the server
  const searchMode = filters.range !== "month";
  const [moreOpen, setMoreOpen] = useState(() => Boolean(filters.min || filters.max));
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const latestKey = useRef("");
  const [rangeTransfers, setRangeTransfers] = useState<{ key: string; transfers: Transfer[] } | null>(null);

  const update = (changes: Partial<TransactionFilters>) => {
    const next = { ...filters, ...changes };
    setFilters(next);
    setSearchParams(filtersToParams(next), { replace: true });
  };
  const clearAll = () => update(DEFAULT_FILTERS);

  // Every category ever used, refreshed whenever the month's data reloads (a new one may have been added)
  useEffect(() => {
    let current = true;
    api
      .get("/transactions/categories")
      .then((res) => current && setAllCategories(res.data.categories))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [monthTransactions]);

  // Search other ranges, waiting for a pause in typing. Reloading the month's data (after an add, edit
  // or delete) gives monthTransactions a new identity, which searches again so the results stay current.
  const queryKey = searchMode ? JSON.stringify(searchQuery(filters, month)) : "";
  useEffect(() => {
    latestKey.current = queryKey;
    if (!queryKey) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/transactions/search", { params: JSON.parse(queryKey) });
        if (latestKey.current !== queryKey) return;
        setResults({ key: queryKey, ...res.data });
        setSearchFailed(false);
      } catch {
        if (latestKey.current === queryKey) setSearchFailed(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryKey, monthTransactions, retry]);

  // Transfers aren't income or spending, so they only show while no type, category, text or amount
  // filter is set. For other date ranges they're fetched alongside the search.
  const showTransfers = filters.type === "all" && filters.category === "all" && !filters.q.trim() && !filters.min && !filters.max;
  const transferKey = searchMode && showTransfers && filters.account !== "none" ? queryKey : "";
  useEffect(() => {
    if (!transferKey) return;
    let live = true;
    const { from, to, account } = JSON.parse(transferKey) as { from?: string; to?: string; account?: string };
    api
      .get("/transfers", { params: { from, to, account } })
      .then((res) => live && setRangeTransfers({ key: transferKey, transfers: res.data.transfers }))
      .catch(() => live && setRangeTransfers({ key: transferKey, transfers: [] }));
    return () => {
      live = false;
    };
  }, [transferKey, monthTransactions]);

  const loadMore = async () => {
    if (!results?.nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.get("/transactions/search", { params: { ...JSON.parse(queryKey), cursor: results.nextCursor } });
      if (latestKey.current === queryKey) {
        setResults(
          (prev) => prev && { ...prev, transactions: [...prev.transactions, ...res.data.transactions], nextCursor: res.data.nextCursor },
        );
      }
    } catch {
      setSearchFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const monthMatches = monthTransactions.filter((t) => matchesFilters(t, filters));
  const current = searchMode ? (results?.key === queryKey ? results : null) : null;
  const list = searchMode ? (current?.transactions ?? results?.transactions ?? []) : monthMatches;
  const totals: Totals | null = searchMode ? (current?.totals ?? results?.totals ?? null) : totalsOf(monthMatches);
  const stale = searchMode && !current && !searchFailed;

  const touches = (t: Transfer) => filters.account === "all" || t.fromId === filters.account || t.toId === filters.account;
  let transfersShown: Transfer[] = [];
  if (showTransfers && filters.account !== "none") {
    transfersShown = searchMode ? (rangeTransfers?.key === transferKey ? rangeTransfers.transfers : []) : monthTransfers.filter(touches);
    // While more entries are still to load, only show transfers down to the oldest entry loaded
    const oldest = searchMode && current?.nextCursor ? list[list.length - 1]?.date : undefined;
    if (oldest) transfersShown = transfersShown.filter((t) => t.date >= oldest);
  }
  const rows: Row[] = [
    ...list.map((item) => ({ kind: "entry" as const, item })),
    ...transfersShown.map((item) => ({ kind: "transfer" as const, item })),
  ].sort((a, b) => (a.item.date < b.item.date ? 1 : a.item.date > b.item.date ? -1 : 0));

  const categoryOptions = Array.from(
    new Set([...allCategories, ...monthTransactions.map((t) => t.category), ...(filters.category !== "all" ? [filters.category] : [])]),
  ).sort((a, b) => a.localeCompare(b));

  // Entries keep pointing at an account after it's removed from Net worth
  const nameOfAccount = (id: string) => {
    if (id === "none") return "No account";
    const account = accounts.find((a) => a.id === id);
    return account ? accountName(account) : "Removed account";
  };
  const showAccounts = accounts.length > 0;
  const chips = activeChips(filters, nameOfAccount);
  const scopeLabel = {
    month: `in ${monthName(month)}`,
    "3m": "in the last 3 months",
    year: "this year",
    all: "across all time",
    custom:
      filters.from && filters.to
        ? `from ${shortDate(filters.from)} to ${shortDate(filters.to)}`
        : filters.from
          ? `since ${shortDate(filters.from)}`
          : filters.to
            ? `until ${shortDate(filters.to)}`
            : "",
  }[filters.range];

  const grouped = rows.reduce((acc: { label: string; items: Row[] }[], row) => {
    const label = dayLabel(row.item.date);
    const last = acc[acc.length - 1];
    if (last && last.label === label) last.items.push(row);
    else acc.push({ label, items: [row] });
    return acc;
  }, []);

  const transferIcon = (size: string) => (
    <span className={`${size} rounded-full shrink-0 flex items-center justify-center bg-ink-100 text-ink-500`}>
      <ArrowLeftRight size={15} />
    </span>
  );
  const transferRoute = (t: Transfer) => (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="truncate">{nameOfAccount(t.fromId)}</span>
      <ArrowRight size={12} className="shrink-0 text-ink-400" />
      <span className="truncate">{nameOfAccount(t.toId)}</span>
    </span>
  );
  const transferAmount = (t: Transfer, extra = "") => (
    <span className={`font-semibold tabular-nums text-ink-500 ${extra}`}>{formatINR(t.amount)}</span>
  );

  // Edit and Delete live in a ⋯ menu; deleting shows an Undo, so it needs no extra question.
  // A shared expense is removed from its group, which takes the share out of here too.
  const entryMenu = (t: Transaction) => {
    const actions: MenuAction[] = [{ label: "Edit", icon: Pencil, onSelect: () => onEdit(t) }];
    if (!t.shareId) actions.push({ label: "Delete", icon: Trash2, danger: true, onSelect: () => onDelete(t) });
    return <ActionMenu label={`Options for ${t.category}`} actions={actions} className="shrink-0" />;
  };
  const transferMenu = (t: Transfer) => (
    <ActionMenu
      label="Options for transfer"
      className="shrink-0"
      actions={[
        { label: "Edit", icon: Pencil, onSelect: () => onEditTransfer(t) },
        { label: "Delete", icon: Trash2, danger: true, onSelect: () => onDeleteTransfer(t) },
      ]}
    />
  );

  const avatar = (t: Transaction, size: string) => (
    <span
      className={`${size} rounded-full shrink-0 flex items-center justify-center font-semibold text-white`}
      style={{ background: colorFor(t.category) }}
    >
      {t.category.charAt(0).toUpperCase()}
    </span>
  );

  // Plain figures: income in green with a plus, spending in the normal text colour
  const amountText = (t: Transaction, extra = "") => (
    <span className={`font-semibold tabular-nums whitespace-nowrap ${extra} ${t.type === "income" ? "text-gain" : "text-ink-900"}`}>
      {t.type === "income" ? "+" : "−"}
      {formatINR(t.amount)}
    </span>
  );

  const repeatIcon = (t: Transaction) =>
    t.recurringId ? (
      <Repeat size={13} className="shrink-0 text-ink-400" aria-label="Added automatically every month" />
    ) : (
      t.shareId && <UsersRound size={13} className="shrink-0 text-ink-400" aria-label="Your share of a shared expense" />
    );

  // Type, category, account and amount filters that are on, for the count on the phone's Filters button
  const panelCount = [filters.type !== "all", filters.category !== "all", filters.account !== "all", Boolean(filters.min), Boolean(filters.max)].filter(Boolean).length;
  const searchInput = (
    <label className="relative flex-1 sm:flex-none sm:w-64">
      <span className="sr-only">Search notes and categories</span>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      <input
        type="search"
        value={filters.q}
        onChange={(e) => update({ q: e.target.value })}
        placeholder={wide ? "Search notes and categories" : "Search notes"}
        maxLength={100}
        className={`${inputClass} w-full py-1.5 pl-9 text-sm`}
      />
    </label>
  );

  const rangeSelect = (
    <select
      value={filters.range}
      onChange={(e) => update({ range: e.target.value as RangeKey })}
      aria-label="Date range"
      className={`${inputClass} py-1.5 text-sm`}
    >
      <option value="month">{monthName(month)}</option>
      <option value="3m">{RANGE_LABELS["3m"]}</option>
      <option value="year">{RANGE_LABELS.year}</option>
      <option value="all">{RANGE_LABELS.all}</option>
      <option value="custom">{RANGE_LABELS.custom}</option>
    </select>
  );

  const typeSelect = (
    <select
      value={filters.type}
      onChange={(e) => update({ type: e.target.value as TransactionFilters["type"] })}
      aria-label="Type"
      className={`${inputClass} py-1.5 text-sm`}
    >
      <option value="all">All types</option>
      <option value="income">Income</option>
      <option value="expense">Expenses</option>
    </select>
  );

  const categorySelect = (
    <select
      value={filters.category}
      onChange={(e) => update({ category: e.target.value })}
      aria-label="Category"
      className={`${inputClass} py-1.5 text-sm max-w-48`}
    >
      <option value="all">All categories</option>
      {categoryOptions.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );

  const accountSelect = (
    <>
          {showAccounts && (
            <select
              value={filters.account}
              onChange={(e) => update({ account: e.target.value })}
              aria-label="Account"
              className={`${inputClass} py-1.5 text-sm max-w-48`}
            >
              <option value="all">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountName(a)}
                </option>
              ))}
              <option value="none">No account</option>
            </select>
          )}
    </>
  );

  const filtersButton = (label: string, count = 0) => (
    <button
      type="button"
      onClick={() => setMoreOpen(!moreOpen)}
      aria-expanded={moreOpen}
      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition ${
        moreOpen ? "border-brand-500 text-brand-700 bg-brand-50" : "border-line text-ink-700 hover:border-ink-300"
      }`}
    >
      <SlidersHorizontal size={15} /> {label}
      {count > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs leading-5 tabular-nums">{count}</span>
      )}
    </button>
  );

  const customDates = (
    <>
          {filters.range === "custom" && (
            <>
              <label className="text-xs font-medium text-ink-500">
                From
                <input
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(e) => update({ from: e.target.value })}
                  className={`${inputClass} block mt-1 py-1.5 text-sm`}
                />
              </label>
              <label className="text-xs font-medium text-ink-500">
                To
                <input
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(e) => update({ to: e.target.value })}
                  className={`${inputClass} block mt-1 py-1.5 text-sm`}
                />
              </label>
            </>
          )}
    </>
  );

  const amountInputs = (
    <>

              <label className="text-xs font-medium text-ink-500">
                Min amount (₹)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={filters.min}
                  onChange={(e) => update({ min: e.target.value })}
                  placeholder="0"
                  className={`${inputClass} block mt-1 py-1.5 text-sm w-36`}
                />
              </label>
              <label className="text-xs font-medium text-ink-500">
                Max amount (₹)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={filters.max}
                  onChange={(e) => update({ max: e.target.value })}
                  placeholder="Any"
                  className={`${inputClass} block mt-1 py-1.5 text-sm w-36`}
                />
              </label>
    </>
  );

  // Wide screens show every filter in one row; phones show search, the date range and a Filters
  // button that opens the rest, so the list isn't pushed down by four rows of controls
  const filterBar = wide ? (
    <div className="p-5 border-b border-line space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h2 className="font-semibold text-ink-900">Transactions</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {searchInput}
          {rangeSelect}
          {typeSelect}
          {categorySelect}
          {accountSelect}
          {filtersButton("More filters")}
        </div>
      </div>
      {(moreOpen || filters.range === "custom") && (
        <div className="flex flex-wrap items-end gap-3 justify-end">
          {customDates}
          {moreOpen && amountInputs}
        </div>
      )}
      {filtering && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => update(chip.clear)}
              aria-label={`Remove filter ${chip.label}`}
              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 transition"
            >
              {chip.label} <X size={13} />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-ink-500 hover:text-ink-900 underline underline-offset-2 transition"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="p-5 border-b border-line space-y-3">
      <h2 className="font-semibold text-ink-900">Transactions</h2>
      <div className="flex [&>label]:w-full">{searchInput}</div>
      <div className="flex gap-2 [&>select]:flex-1 [&>select]:min-w-0">
        {rangeSelect}
        {filtersButton("Filters", panelCount)}
      </div>
      {filters.range === "custom" && <div className="grid grid-cols-2 gap-3 [&_input]:w-full">{customDates}</div>}
      {moreOpen && (
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-canvas border border-line [&>select]:w-full [&>select]:max-w-none [&_input]:w-full">
          {typeSelect}
          {categorySelect}
          {showAccounts && <div className="col-span-2 [&>select]:w-full [&>select]:max-w-none">{accountSelect}</div>}
          {amountInputs}
        </div>
      )}
      {filtering && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => update(chip.clear)}
              aria-label={`Remove filter ${chip.label}`}
              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 transition"
            >
              {chip.label} <X size={13} />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-ink-500 hover:text-ink-900 underline underline-offset-2 transition"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );

  // What the filters add up to, so "how much did I spend on X?" has an answer
  const totalsBar = filtering && totals && (
    <p
      className={`px-5 py-3 bg-canvas border-b border-line text-sm text-ink-700 transition-opacity ${stale ? "opacity-50" : ""}`}
      aria-live="polite"
    >
      <span className="font-semibold text-ink-900">
        {totals.count} transaction{totals.count === 1 ? "" : "s"}
      </span>
      <span className="text-ink-400"> · </span>
      <span className="font-semibold text-loss tabular-nums">{formatINR(totals.expense)}</span> spent
      <span className="text-ink-400"> · </span>
      <span className="font-semibold text-gain tabular-nums">{formatINR(totals.income)}</span> earned
      {scopeLabel && <span className="text-ink-500"> {scopeLabel}</span>}
    </p>
  );

  let body;
  if (searchMode && searchFailed) {
    body = (
      <p className="p-5 text-sm text-loss">
        We couldn't search your transactions.{" "}
        <button onClick={() => setRetry(retry + 1)} className="font-medium underline underline-offset-2 hover:no-underline">
          Try again
        </button>
      </p>
    );
  } else if (searchMode && !results) {
    body = <p className="p-5 text-sm text-ink-500">Searching…</p>;
  } else if (!searchMode && monthTransactions.length === 0 && monthTransfers.length === 0 && !filtering) {
    body = (
      <div className="px-5 py-14 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
          <Receipt size={22} className="text-brand-600" />
        </div>
        <p className="mt-4 font-medium text-ink-900">No transactions in {monthName(month)}</p>
        <p className="mt-1 text-sm text-ink-500">
          {isCurrentMonth ? "Add an income or expense above to start tracking." : "Nothing was recorded this month."}
        </p>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className={`px-5 py-10 text-center transition-opacity ${stale ? "opacity-50" : ""}`}>
        <p className="font-medium text-ink-900">No transactions match these filters</p>
        <p className="mt-1 text-sm text-ink-500">
          {filters.range === "month" ? "Try a wider date range, or " : "Try "}
          <button onClick={clearAll} className="font-medium text-brand-700 underline underline-offset-2 hover:no-underline">
            clearing the filters
          </button>
          .
        </p>
      </div>
    );
  } else {
    body = (
      <div className={`transition-opacity ${stale ? "opacity-50" : ""}`} aria-busy={stale}>
        {wide ? (
          <table className="w-full text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th scope="col" className="text-left font-medium px-5 py-2.5 w-32">
                  Date
                </th>
                <th scope="col" className="text-left font-medium px-5 py-2.5">
                  Category
                </th>
                <th scope="col" className="text-left font-medium px-5 py-2.5">
                  Note
                </th>
                {showAccounts && (
                  <th scope="col" className="text-left font-medium px-5 py-2.5">
                    Account
                  </th>
                )}
                <th scope="col" className="text-right font-medium px-5 py-2.5">
                  Amount
                </th>
                <th scope="col" className="px-3 py-2.5 w-16">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                if (row.kind === "transfer") {
                  return (
                    <tr key={`transfer-${row.item.id}`} className="hover:bg-canvas transition">
                      <td className="px-5 py-3 text-ink-500 whitespace-nowrap">{dayLabel(row.item.date)}</td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3 min-w-0">
                          {transferIcon("w-8 h-8")}
                          <span className="font-medium text-ink-900">Transfer</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-500 max-w-xs truncate">{row.item.note || "—"}</td>
                      {showAccounts && <td className="px-5 py-3 text-ink-500 max-w-56">{transferRoute(row.item)}</td>}
                      <td className="px-5 py-3 text-right">{transferAmount(row.item)}</td>
                      <td className="px-3 py-1.5">
                        <span className="flex justify-end">{transferMenu(row.item)}</span>
                      </td>
                    </tr>
                  );
                }
                const t = row.item;
                return (
                  <tr key={t.id} className="hover:bg-canvas transition">
                    <td className="px-5 py-3 text-ink-500 whitespace-nowrap">{dayLabel(t.date)}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3 min-w-0">
                        {avatar(t, "w-8 h-8 text-xs")}
                        <span className="font-medium text-ink-900 truncate">{t.category}</span>
                        {repeatIcon(t)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-500 max-w-xs truncate">{t.note || "—"}</td>
                    {showAccounts && (
                      <td className="px-5 py-3 text-ink-500 max-w-40 truncate">{t.accountId ? nameOfAccount(t.accountId) : "—"}</td>
                    )}
                    <td className="px-5 py-3 text-right">{amountText(t)}</td>
                    <td className="px-3 py-1.5">
                      <span className="flex justify-end">{entryMenu(t)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              <p className="px-5 py-2 bg-canvas text-xs font-medium uppercase tracking-wider text-ink-500 border-b border-line">
                {group.label}
              </p>
              {group.items.map((row) => {
                if (row.kind === "transfer") {
                  return (
                    <div key={`transfer-${row.item.id}`} className="flex items-center gap-1 pr-2 border-b border-line last:border-0">
                      <button
                        type="button"
                        onClick={() => onEditTransfer(row.item)}
                        className="flex-1 min-w-0 flex justify-between items-center gap-3 pl-5 pr-1 py-4 text-left hover:bg-canvas transition"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          {transferIcon("w-9 h-9")}
                          <span className="min-w-0">
                            <span className="block font-medium text-ink-900">Transfer</span>
                            {/* Wraps onto a second line rather than cutting the account names short */}
                            <span className="block text-sm text-ink-500 line-clamp-2 break-words">
                              {nameOfAccount(row.item.fromId)} → {nameOfAccount(row.item.toId)}
                              {row.item.note && ` · ${row.item.note}`}
                            </span>
                          </span>
                        </span>
                        {transferAmount(row.item, "text-sm shrink-0")}
                      </button>
                      {transferMenu(row.item)}
                    </div>
                  );
                }
                const t = row.item;
                return (
                  <div key={t.id} className="flex items-center gap-1 pr-2 border-b border-line last:border-0">
                    {/* Tapping an entry opens it for editing; Delete is in the ⋯ menu */}
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      className="flex-1 min-w-0 flex justify-between items-center gap-3 pl-5 pr-1 py-4 text-left hover:bg-canvas transition"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        {avatar(t, "w-9 h-9 text-sm")}
                        <span className="min-w-0">
                          <span className="font-medium text-ink-900 truncate flex items-center gap-1.5">
                            {t.category}
                            {repeatIcon(t)}
                          </span>
                          {(t.note || (showAccounts && t.accountId)) && (
                            <span className="block text-sm text-ink-500 line-clamp-2 break-words">
                              {[showAccounts && t.accountId ? nameOfAccount(t.accountId) : "", t.note].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                      </span>
                      {amountText(t, "text-sm shrink-0")}
                    </button>
                    {entryMenu(t)}
                  </div>
                );
              })}
            </div>
          ))
        )}
        {searchMode && current?.nextCursor && (
          <div className="p-4 border-t border-line text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 rounded-xl border border-line text-sm font-medium text-ink-700 hover:border-ink-300 transition disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : `Load more (${current.totals.count - current.transactions.length} left)`}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="bg-surface rounded-2xl border border-line overflow-hidden">
      {filterBar}
      {totalsBar}
      {body}
    </section>
  );
}

export default TransactionsCard;

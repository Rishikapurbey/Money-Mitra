import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowLeft, Check, FileSpreadsheet, Lock, Upload } from "lucide-react";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import { formatINR, inputClass, pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { toInputDate, transactionTimestamp } from "../lib/dates";
import { announceDataChange } from "../lib/dataEvents";
import { useCategories } from "../lib/categories";
import { withBudgetAlert } from "../lib/budgetAlerts";
import {
  FALLBACK_CATEGORY,
  MAX_FILE_BYTES,
  MAX_IMPORT_ROWS,
  buildHistory,
  detectDateOrder,
  findDuplicates,
  findHeaderRow,
  guessCategory,
  guessMapping,
  guessUnsignedMeans,
  isMappingComplete,
  normalizeNote,
  parseCsv,
  readRows,
} from "../lib/csvImport";
import type { DateOrder, DraftRow, Grid, Mapping, SkippedRow, TxType } from "../lib/csvImport";

type Step = "file" | "map" | "review";

interface Existing {
  note?: string | null;
  category: string;
  type: string;
  date: string;
  amount: number;
}

interface Item extends DraftRow {
  key: number;
  include: boolean;
  duplicate: boolean;
  // Changed by hand, so matching rows changing later won't overwrite it
  edited: boolean;
}

const STEPS: { key: Step; label: string }[] = [
  { key: "file", label: "Choose file" },
  { key: "map", label: "Match columns" },
  { key: "review", label: "Review" },
];

const PAGE_SIZE = 100;
const NEW_CATEGORY = "__new__";

const showDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const plural = (n: number, word: string) => `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

const primaryButton =
  "bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed";
const secondaryButton =
  "px-5 py-2.5 rounded-xl border border-line font-medium text-ink-900 hover:bg-ink-100 transition disabled:opacity-60";

function Steps({ current }: { current: Step }) {
  const index = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-3">
          <span
            aria-current={i === index ? "step" : undefined}
            className={`flex items-center gap-2 ${i === index ? "text-ink-900 font-medium" : i < index ? "text-brand-600" : "text-ink-400"}`}
          >
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                i === index ? "bg-brand-600 text-white" : i < index ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
              }`}
            >
              {i < index ? <Check size={13} /> : i + 1}
            </span>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span aria-hidden="true" className="w-8 h-px bg-line" />}
        </li>
      ))}
    </ol>
  );
}

function Card({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      {title && <h2 className="font-semibold text-ink-900">{title}</h2>}
      {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      <div className={title || description ? "mt-5" : ""}>{children}</div>
    </section>
  );
}

function ColumnSelect({
  label,
  value,
  headers,
  optional,
  onChange,
}: {
  label: string;
  value: number;
  headers: string[];
  optional?: boolean;
  onChange: (column: number) => void;
}) {
  return (
    <label className="block text-sm font-medium text-ink-700">
      {label}
      {optional && <span className="font-normal text-ink-400"> (optional)</span>}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={`${inputClass} w-full mt-1 font-normal`}>
        <option value={-1}>{optional ? "None" : "Choose a column"}</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink-700">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-1 grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`py-2 px-2 rounded-lg transition ${value === o.value ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ImportTransactions() {
  useTitle("Import transactions");
  const navigate = useNavigate();
  const toast = useToast();
  const wide = useWideLayout();
  const { categories } = useCategories();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [grid, setGrid] = useState<Grid>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>(guessMapping([]));
  // null until the user picks; the guess from the file is used meanwhile
  const [dateOrderChoice, setDateOrderChoice] = useState<DateOrder | null>(null);
  const [unsignedChoice, setUnsignedChoice] = useState<TxType | null>(null);
  const [mapError, setMapError] = useState("");

  const [existing, setExisting] = useState<Existing[]>([]);
  const [existingFailed, setExistingFailed] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [skipped, setSkipped] = useState<SkippedRow[]>([]);
  const [filter, setFilter] = useState<"all" | "duplicates" | "skipped">("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [newCategoryFor, setNewCategoryFor] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Everything already saved, to spot duplicates and learn which categories the user picks
  useEffect(() => {
    let current = true;
    api.get("/transactions").then(
      (res) => current && setExisting(res.data.transactions),
      () => current && setExistingFailed(true)
    );
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const columnCount = useMemo(
    () => Math.max(0, ...grid.slice(headerRow, headerRow + 50).map((r) => r.length)),
    [grid, headerRow]
  );
  const headers = useMemo(
    () => Array.from({ length: columnCount }, (_, i) => grid[headerRow]?.[i] || `Column ${i + 1}`),
    [grid, headerRow, columnCount]
  );
  const dateInfo = useMemo(
    () => detectDateOrder(mapping.date === -1 ? [] : grid.slice(headerRow + 1).map((r) => r[mapping.date] ?? "")),
    [grid, headerRow, mapping.date]
  );
  const unsignedGuess = useMemo(() => guessUnsignedMeans(grid, headerRow, mapping.amount), [grid, headerRow, mapping.amount]);
  const dateOrder = dateOrderChoice ?? dateInfo.order;
  const unsignedMeans = unsignedChoice ?? unsignedGuess;
  const complete = isMappingComplete(mapping);
  const preview = useMemo(
    () => (complete ? readRows(grid, headerRow, mapping, { dateOrder, unsignedMeans }) : null),
    [complete, grid, headerRow, mapping, dateOrder, unsignedMeans]
  );

  const chooseHeaderRow = (rows: Grid, row: number) => {
    setHeaderRow(row);
    setMapping(guessMapping(rows[row] ?? []));
    setDateOrderChoice(null);
    setUnsignedChoice(null);
    setMapError("");
  };

  const readFile = async (file: File) => {
    setFileError("");
    if (/\.(xlsx?|pdf|numbers)$/i.test(file.name)) {
      return setFileError("This looks like an Excel or PDF file. Open it in Excel or Google Sheets and save it as CSV first.");
    }
    if (file.size > MAX_FILE_BYTES) return setFileError("This file is bigger than 5 MB. Try a shorter date range.");
    let rows: Grid;
    try {
      rows = parseCsv(await file.text());
    } catch {
      return setFileError("We couldn't read this file. Check that it's a CSV file.");
    }
    if (rows.length < 2) return setFileError("We couldn't find any rows in this file.");
    setGrid(rows);
    setFileName(file.name);
    chooseHeaderRow(rows, findHeaderRow(rows));
    setStep("map");
  };

  const toReview = () => {
    if (!preview) return;
    if (preview.rows.length === 0) return setMapError("None of the rows could be read. Check the columns and date format above.");
    if (preview.rows.length > MAX_IMPORT_ROWS) {
      return setMapError(
        `This file has ${preview.rows.length.toLocaleString("en-IN")} transactions. You can import up to ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} at a time, so try a shorter date range.`
      );
    }
    const history = buildHistory(existing);
    const duplicates = findDuplicates(
      preview.rows,
      existing.map((t) => ({ day: toInputDate(new Date(t.date)), type: t.type, amount: t.amount }))
    );
    setItems(
      preview.rows.map((row, i) => ({
        ...row,
        key: i,
        category: row.category || guessCategory(row.note, row.type, history) || FALLBACK_CATEGORY,
        include: !duplicates[i],
        duplicate: duplicates[i],
        edited: false,
      }))
    );
    setSkipped(preview.skipped);
    setFilter("all");
    setLimit(PAGE_SIZE);
    setSubmitError("");
    setStep("review");
  };

  const selected = useMemo(() => items.filter((i) => i.include), [items]);
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let first = "";
    let last = "";
    for (const i of selected) {
      if (i.type === "income") income += i.amount;
      else expense += i.amount;
      if (!first || i.day < first) first = i.day;
      if (!last || i.day > last) last = i.day;
    }
    return { income, expense, first, last };
  }, [selected]);

  // Category names offered for each type: the user's list plus any already used in this file
  const optionsFor = (type: TxType) => {
    const names = new Map<string, string>();
    for (const c of categories) if (c.type === type) names.set(c.name.toLowerCase(), c.name);
    for (const i of items) if (i.type === type && !names.has(i.category.toLowerCase())) names.set(i.category.toLowerCase(), i.category);
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  };

  const newCategories = useMemo(() => {
    const known = new Set(categories.map((c) => `${c.type}:${c.name.toLowerCase()}`));
    const found = new Map<string, string>();
    for (const i of selected) {
      const key = `${i.type}:${i.category.toLowerCase()}`;
      if (!known.has(key)) found.set(key, i.category);
    }
    return [...found.values()];
  }, [selected, categories]);

  const duplicateCount = items.filter((i) => i.duplicate).length;
  const visible = filter === "duplicates" ? items.filter((i) => i.duplicate) : items;
  const allVisibleIncluded = visible.length > 0 && visible.every((i) => i.include);

  const toggle = (key: number) => setItems((list) => list.map((i) => (i.key === key ? { ...i, include: !i.include } : i)));
  const includeVisible = (include: boolean) => {
    const keys = new Set(visible.map((i) => i.key));
    setItems((list) => list.map((i) => (keys.has(i.key) ? { ...i, include } : i)));
  };

  // A new category also goes to rows with the same description that haven't been changed by hand
  const setCategory = (key: number, category: string) => {
    setItems((list) => {
      const target = list.find((i) => i.key === key);
      if (!target) return list;
      const note = normalizeNote(target.note);
      return list.map((i) => {
        if (i.key === key) return { ...i, category, edited: true };
        if (note && !i.edited && i.type === target.type && normalizeNote(i.note) === note) return { ...i, category };
        return i;
      });
    });
  };

  const commitNewCategory = () => {
    const name = newCategory.trim().slice(0, 50);
    if (newCategoryFor !== null && name) setCategory(newCategoryFor, name);
    setNewCategoryFor(null);
    setNewCategory("");
  };

  const submit = async () => {
    setBusy(true);
    setSubmitError("");
    try {
      const { data } = await api.post("/imports", {
        fileName,
        tzOffset: new Date().getTimezoneOffset(),
        rows: selected.map((i) => ({
          date: transactionTimestamp(i.day),
          amount: i.amount,
          type: i.type,
          category: i.category,
          note: i.note,
        })),
      });
      const id: string = data.import.id;
      announceDataChange();
      toast({
        message: withBudgetAlert(`Imported ${plural(data.import.count, "transaction")}`, data.budgetAlert),
        action: {
          label: "Undo",
          onClick: () =>
            api.delete(`/imports/${id}`).then(
              () => {
                announceDataChange();
                toast({ message: "Import undone" });
              },
              () => toast({ message: "We couldn't undo the import. You can try again in Settings, under Your data." })
            ),
        },
      });
      navigate("/tracker", { state: { month: totals.last } });
    } catch (err) {
      setSubmitError((isAxiosError(err) && err.response?.data?.error) || "We couldn't import these transactions. Please try again.");
      setBusy(false);
    }
  };

  const header = (
    <div className="space-y-4">
      <Link to="/tracker" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
        <ArrowLeft size={16} /> Tracker
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Import transactions</h1>
          <p className="mt-1 text-sm text-ink-500">Add entries from a bank statement or spreadsheet saved as CSV.</p>
        </div>
        <Steps current={step} />
      </div>
    </div>
  );

  // Step 1: choosing a file
  if (step === "file") {
    const dropzone = (
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) readFile(file);
        }}
        className={`bg-surface border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center transition ${
          dragging ? "border-brand-500 bg-brand-50" : "border-line"
        }`}
      >
        <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
          <FileSpreadsheet size={24} />
        </div>
        <h2 className="mt-4 font-semibold text-ink-900">Drop your CSV file here</h2>
        <p className="mt-1 text-sm text-ink-500">or choose it from your device</p>
        <button type="button" onClick={() => fileInput.current?.click()} className={`${primaryButton} mt-6 inline-flex items-center gap-2`}>
          <Upload size={16} /> Choose file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) readFile(file);
          }}
        />
        {fileError && (
          <p role="alert" className="mt-6 mx-auto max-w-md flex items-start gap-2 text-left text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {fileError}
          </p>
        )}
      </section>
    );

    const tips = (
      <div className="space-y-6">
        <Card title="Getting a CSV from your bank">
          <ol className="space-y-3 text-sm text-ink-700 list-decimal pl-5">
            <li>In net banking, open your account statement and pick the dates you want.</li>
            <li>Download it as CSV. If your bank only offers Excel, open the file in Excel or Google Sheets and save or download it as CSV.</li>
            <li>Choose that file here. You'll match its columns and check every row before anything is saved.</li>
          </ol>
          <p className="mt-4 text-sm text-ink-500">
            A file from Settings, under Your data, works too. Up to {MAX_IMPORT_ROWS.toLocaleString("en-IN")} transactions at a time.
          </p>
        </Card>
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 text-sm text-ink-700">
          <Lock size={18} className="shrink-0 text-brand-600 mt-0.5" />
          <p>
            Your file is read on this device. Only the transactions you choose to import are sent to Money Mitra, and the file
            itself is never uploaded.
          </p>
        </div>
      </div>
    );

    return (
      <main className={`${pageWidth} py-8 space-y-6`}>
        {header}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
          {dropzone}
          {tips}
        </div>
      </main>
    );
  }

  // Step 2: matching columns
  if (step === "map") {
    const sample = grid.slice(headerRow + 1, headerRow + 7);
    const roles = new Map<number, string>();
    const role = (column: number, label: string) => column !== -1 && roles.set(column, label);
    role(mapping.date, "Date");
    role(mapping.description, "Description");
    if (mapping.amountMode === "single") role(mapping.amount, "Amount");
    else {
      role(mapping.debit, "Money out");
      role(mapping.credit, "Money in");
    }
    role(mapping.type, "Type");
    role(mapping.category, "Category");
    const set = (changes: Partial<Mapping>) => {
      setMapping((m) => ({ ...m, ...changes }));
      setMapError("");
    };

    const table = (
      <Card title="Your file" description={`${fileName} · ${plural(grid.length - headerRow - 1, "row")} below the headings`}>
        <label className="block text-sm font-medium text-ink-700 max-w-md">
          Column headings are on
          <select
            value={headerRow}
            onChange={(e) => chooseHeaderRow(grid, Number(e.target.value))}
            className={`${inputClass} w-full mt-1 font-normal`}
          >
            {grid.slice(0, 40).map((r, i) => (
              <option key={i} value={i}>
                Row {i + 1}: {r.filter(Boolean).slice(0, 4).join(", ").slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2 text-left font-medium text-ink-900 whitespace-nowrap align-bottom">
                    {roles.has(i) && (
                      <span className="block mb-1 w-fit text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                        {roles.get(i)}
                      </span>
                    )}
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sample.map((r, ri) => (
                <tr key={ri}>
                  {headers.map((_, i) => (
                    <td key={i} className={`px-3 py-2 whitespace-nowrap max-w-64 truncate ${roles.has(i) ? "text-ink-900" : "text-ink-400"}`}>
                      {r[i] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );

    const firstRows = preview?.rows.slice(0, 3) ?? [];
    const form = (
      <Card title="Match columns" description="We've guessed from the headings. Change anything that's wrong.">
        <div className="space-y-4">
          <ColumnSelect label="Date" value={mapping.date} headers={headers} onChange={(date) => set({ date })} />
          <ColumnSelect label="Description" optional value={mapping.description} headers={headers} onChange={(description) => set({ description })} />
          <Choice
            label="Amounts are in"
            value={mapping.amountMode}
            options={[
              { value: "single", label: "One column" },
              { value: "split", label: "Debit and credit" },
            ]}
            onChange={(amountMode) => set({ amountMode })}
          />
          {mapping.amountMode === "single" ? (
            <>
              <ColumnSelect label="Amount" value={mapping.amount} headers={headers} onChange={(amount) => set({ amount })} />
              <ColumnSelect label="Income or expense" optional value={mapping.type} headers={headers} onChange={(type) => set({ type })} />
              {mapping.type === -1 && (
                <div>
                  <Choice
                    label="Amounts without a minus sign are"
                    value={unsignedMeans}
                    options={[
                      { value: "income", label: "Money in" },
                      { value: "expense", label: "Money out" },
                    ]}
                    onChange={setUnsignedChoice}
                  />
                  <p className="mt-1.5 text-xs text-ink-500">Amounts with a minus sign are counted the other way.</p>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <ColumnSelect label="Money out (debit)" value={mapping.debit} headers={headers} onChange={(debit) => set({ debit })} />
              <ColumnSelect label="Money in (credit)" value={mapping.credit} headers={headers} onChange={(credit) => set({ credit })} />
            </div>
          )}
          <ColumnSelect label="Category" optional value={mapping.category} headers={headers} onChange={(category) => set({ category })} />
          {dateInfo.numeric && (
            <div>
              <Choice
                label="Dates are written"
                value={dateOrder}
                options={[
                  { value: "dmy", label: "Day first (31/12)" },
                  { value: "mdy", label: "Month first (12/31)" },
                ]}
                onChange={setDateOrderChoice}
              />
              {dateInfo.ambiguous && dateOrderChoice === null && (
                <p className="mt-1.5 text-xs text-ink-500">We couldn't tell from the file, so we've assumed day first.</p>
              )}
            </div>
          )}
        </div>

        {preview && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-medium text-ink-900">
              {plural(preview.rows.length, "transaction")} found
              {preview.skipped.length > 0 && <span className="font-normal text-ink-500"> · {plural(preview.skipped.length, "row")} skipped</span>}
            </p>
            {firstRows.length > 0 && (
              <ul className="mt-3 space-y-2">
                {firstRows.map((r) => (
                  <li key={r.line} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink-700">
                      <span className="text-ink-500 tabular-nums">{showDay(r.day)}</span> · {r.note || "No description"}
                    </span>
                    <span className={`shrink-0 tabular-nums font-medium ${r.type === "income" ? "text-gain" : "text-ink-900"}`}>
                      {r.type === "income" ? "+" : "−"}
                      {formatINR(r.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {mapError && (
          <p role="alert" className="mt-4 text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">
            {mapError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={toReview} disabled={!complete} className={primaryButton}>
            Continue
          </button>
          <button type="button" onClick={() => setStep("file")} className={secondaryButton}>
            Choose another file
          </button>
        </div>
      </Card>
    );

    return (
      <main className={`${pageWidth} py-8 space-y-6`}>
        {header}
        {wide ? (
          <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
            <div className="min-w-0">{table}</div>
            <aside className="sticky top-20">{form}</aside>
          </div>
        ) : (
          <>
            {form}
            {table}
          </>
        )}
      </main>
    );
  }

  // Step 3: reviewing rows
  const summary = (
    <Card title="Ready to import">
      <p className="text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{selected.length.toLocaleString("en-IN")}</p>
      <p className="text-sm text-ink-500">
        of {plural(items.length, "transaction")} selected
        {totals.first && ` · ${showDay(totals.first)}${totals.last !== totals.first ? ` to ${showDay(totals.last)}` : ""}`}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-ink-500">Money in</dt>
          <dd className="mt-1 font-semibold text-gain tabular-nums">{formatINR(totals.income)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-ink-500">Money out</dt>
          <dd className="mt-1 font-semibold text-ink-900 tabular-nums">{formatINR(totals.expense)}</dd>
        </div>
      </dl>
      {newCategories.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm text-ink-700">These new categories will be added to your list:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {newCategories.map((c) => (
              <span key={c} className="text-xs font-medium text-ink-700 bg-ink-100 px-2.5 py-1 rounded-full">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 space-y-2 text-sm">
        {duplicateCount > 0 && (
          <p className="flex items-start gap-2 text-ink-700 bg-warn-soft px-3 py-2 rounded-lg">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-warn" />
            {plural(duplicateCount, "row")} look{duplicateCount === 1 ? "s" : ""} like {duplicateCount === 1 ? "an entry" : "entries"} you already have, so{" "}
            {duplicateCount === 1 ? "it isn't" : "they aren't"} ticked.
          </p>
        )}
        {existingFailed && (
          <p className="flex items-start gap-2 text-ink-700 bg-warn-soft px-3 py-2 rounded-lg">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-warn" />
            We couldn't load your existing transactions, so duplicates aren't marked.
          </p>
        )}
        {skipped.length > 0 && (
          <p className="text-ink-500">
            {plural(skipped.length, "row")} couldn't be read and will be left out.{" "}
            <button type="button" onClick={() => setFilter("skipped")} className="font-medium text-brand-600 hover:underline">
              See which
            </button>
          </p>
        )}
      </div>
      {submitError && (
        <p role="alert" className="mt-4 text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">
          {submitError}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={submit} disabled={busy || selected.length === 0} className={primaryButton}>
          {busy ? "Importing…" : `Import ${plural(selected.length, "transaction")}`}
        </button>
        <button type="button" onClick={() => setStep("map")} disabled={busy} className={secondaryButton}>
          Back
        </button>
      </div>
      <p className="mt-4 text-xs text-ink-500">You can undo the whole import later from Settings, under Your data.</p>
    </Card>
  );

  const tabs: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "duplicates", label: "Possible duplicates", count: duplicateCount },
    { key: "skipped", label: "Skipped", count: skipped.length },
  ];

  const rowGrid = "grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_7.5rem_minmax(0,1fr)_13rem_8rem] gap-x-4 gap-y-2 items-center";

  const list = (
    <section className="bg-surface border border-line rounded-2xl">
      <div className="p-6 pb-4">
        <h2 className="font-semibold text-ink-900">Check your transactions</h2>
        <p className="mt-1 text-sm text-ink-500">
          Untick anything you don't want. Changing a category also changes other rows with the same description.
        </p>
        <div role="tablist" aria-label="Show" className="mt-4 flex flex-wrap gap-2">
          {tabs
            .filter((t) => t.key === "all" || t.count > 0)
            .map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={filter === t.key}
                onClick={() => {
                  setFilter(t.key);
                  setLimit(PAGE_SIZE);
                }}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  filter === t.key ? "bg-ink-900 text-surface" : "bg-surface border border-line text-ink-700 hover:border-ink-300"
                }`}
              >
                {t.label} <span className="tabular-nums opacity-70">{t.count.toLocaleString("en-IN")}</span>
              </button>
            ))}
        </div>
      </div>

      {filter === "skipped" ? (
        <ul className="divide-y divide-line border-t border-line">
          {skipped.slice(0, limit).map((s) => (
            <li key={s.line} className="px-6 py-3 text-sm">
              <p className="text-ink-900">
                Row {s.line}: <span className="text-ink-500">{s.reason}</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-500 truncate">{s.text || "Empty row"}</p>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className={`${rowGrid} px-6 py-2 border-t border-line bg-canvas text-xs font-medium uppercase tracking-wider text-ink-500`}>
            <input
              type="checkbox"
              checked={allVisibleIncluded}
              onChange={(e) => includeVisible(e.target.checked)}
              aria-label="Select all"
              className="w-4 h-4 accent-brand-600"
            />
            <span className="hidden md:block">Date</span>
            <span>Description</span>
            <span className="hidden md:block">Category</span>
            <span className="text-right">Amount</span>
          </div>
          <ul className="divide-y divide-line">
            {visible.slice(0, limit).map((i) => (
              <li key={i.key} className={`${rowGrid} px-6 py-3 ${i.include ? "" : "opacity-60"}`}>
                <input
                  type="checkbox"
                  checked={i.include}
                  onChange={() => toggle(i.key)}
                  aria-label={`Import ${i.note || "row " + i.line}`}
                  className="w-4 h-4 accent-brand-600"
                />
                <span className="hidden md:block text-sm text-ink-700 tabular-nums">{showDay(i.day)}</span>
                <div className="min-w-0">
                  <p className="text-sm text-ink-900 truncate" title={i.note}>
                    {i.note || <span className="text-ink-400">No description</span>}
                  </p>
                  <p className="text-xs text-ink-500">
                    <span className="md:hidden tabular-nums">{showDay(i.day)} · </span>
                    Row {i.line}
                    {i.duplicate && <span className="ml-2 font-medium text-warn">Possible duplicate</span>}
                  </p>
                </div>
                <div className="col-start-2 md:col-start-auto">
                  {newCategoryFor === i.key ? (
                    <input
                      autoFocus
                      value={newCategory}
                      maxLength={50}
                      placeholder="New category"
                      onChange={(e) => setNewCategory(e.target.value)}
                      onBlur={commitNewCategory}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitNewCategory();
                        if (e.key === "Escape") setNewCategoryFor(null);
                      }}
                      className={`${inputClass} w-full !py-1.5 text-sm`}
                    />
                  ) : (
                    <select
                      value={i.category}
                      aria-label="Category"
                      onChange={(e) => {
                        if (e.target.value === NEW_CATEGORY) {
                          setNewCategoryFor(i.key);
                          setNewCategory("");
                        } else setCategory(i.key, e.target.value);
                      }}
                      className={`${inputClass} w-full !py-1.5 text-sm`}
                    >
                      {optionsFor(i.type).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value={NEW_CATEGORY}>New category…</option>
                    </select>
                  )}
                </div>
                <span
                  className={`row-start-1 col-start-3 md:row-start-auto md:col-start-auto text-right text-sm font-medium tabular-nums ${
                    i.type === "income" ? "text-gain" : "text-ink-900"
                  }`}
                >
                  {i.type === "income" ? "+" : "−"}
                  {formatINR(i.amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(filter === "skipped" ? skipped.length : visible.length) > limit && (
        <div className="p-4 border-t border-line text-center">
          <button type="button" onClick={() => setLimit((n) => n + PAGE_SIZE)} className="text-sm font-medium text-brand-600 hover:underline">
            Show more
          </button>
        </div>
      )}
    </section>
  );

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      {header}
      {wide ? (
        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          <div className="min-w-0">{list}</div>
          <aside className="sticky top-20">{summary}</aside>
        </div>
      ) : (
        <>
          {summary}
          {list}
        </>
      )}
    </main>
  );
}

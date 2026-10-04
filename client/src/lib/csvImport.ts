// Reading a bank statement or spreadsheet saved as CSV, entirely on the device, and turning its
// rows into transactions the user can review before anything is sent to the server.

export type Grid = string[][];
export type TxType = "income" | "expense";

export const MAX_IMPORT_ROWS = 2000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FALLBACK_CATEGORY = "Other";

const DELIMITERS = [",", ";", "\t", "|"];

function countOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (c === delimiter && !quoted) count++;
  }
  return count;
}

// The separator used on most lines the same number of times
function detectDelimiter(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
  let best = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const counts = new Map<number, number>();
    for (const line of lines) {
      const n = countOutsideQuotes(line, d);
      if (n > 0) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const score = Math.max(0, ...counts.values());
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

// Our own export adds a ' before text like "=..." so spreadsheets don't run it; take it off again
const cleanCell = (s: string) => {
  const trimmed = s.trim();
  return /^'[=+\-@]/.test(trimmed) ? trimmed.slice(1) : trimmed;
};

// Splits CSV text into rows of cells, handling quoted fields (with commas, quotes or line breaks inside)
export function parseCsv(text: string): Grid {
  const src = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(src);
  const rows: Grid = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (src[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"' && field.trim() === "") {
      field = "";
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map(cleanCell)).filter((r) => r.some((cell) => cell !== ""));
}

const DATE_HEADING = /date/i;
const MONEY_HEADING = /amount|amt|debit|credit|withdrawal|deposit/i;

// Statements often start with account details; the table starts at the first row with
// headings for a date and an amount. Falls back to the first row with three or more cells.
export function findHeaderRow(grid: Grid) {
  const limit = Math.min(grid.length, 40);
  for (let i = 0; i < limit; i++) {
    if (grid[i].some((c) => DATE_HEADING.test(c)) && grid[i].some((c) => MONEY_HEADING.test(c))) return i;
  }
  const wide = grid.slice(0, limit).findIndex((r) => r.filter(Boolean).length >= 3);
  return wide === -1 ? 0 : wide;
}

// Which column holds each field, or -1 for none
export interface Mapping {
  date: number;
  description: number;
  amountMode: "single" | "split";
  amount: number;
  debit: number;
  credit: number;
  type: number;
  category: number;
}

export const EMPTY_MAPPING: Mapping = {
  date: -1,
  description: -1,
  amountMode: "single",
  amount: -1,
  debit: -1,
  credit: -1,
  type: -1,
  category: -1,
};

// Best guess at the columns from the headings, e.g. HDFC's "Narration" and "Withdrawal Amt."
export function guessMapping(headers: string[]): Mapping {
  const names = headers.map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const used = new Set<number>();
  const pick = (test: (name: string) => boolean) => {
    const i = names.findIndex((name, index) => !used.has(index) && name !== "" && test(name));
    if (i !== -1) used.add(i);
    return i;
  };
  const notBalance = (name: string) => !name.includes("balance");

  const mapping = { ...EMPTY_MAPPING };
  mapping.type = pick((n) => /^(dr ?[/|] ?cr|cr ?[/|] ?dr|type|txn type|transaction type|debit ?\/ ?credit)$/.test(n));
  mapping.date = pick((n) => /^((txn|transaction|tran|posting|value)\.? )?date\b/.test(n) && !n.startsWith("value"));
  if (mapping.date === -1) mapping.date = pick((n) => n.includes("date"));
  mapping.debit = pick((n) => notBalance(n) && /debit|withdrawal|\bdr\b|money out|paid out/.test(n));
  mapping.credit = pick((n) => notBalance(n) && /credit|deposit|\bcr\b|money in|paid in/.test(n));
  if (mapping.debit === -1 || mapping.credit === -1) {
    // One of a pair is not enough to work with; treat it as a plain amount column instead
    for (const i of [mapping.debit, mapping.credit]) if (i !== -1) used.delete(i);
    mapping.debit = mapping.credit = -1;
  } else mapping.amountMode = "split";
  if (mapping.amountMode === "single") mapping.amount = pick((n) => notBalance(n) && /amount|amt|debit|credit/.test(n));
  mapping.category = pick((n) => n.includes("category"));
  mapping.description = pick((n) => /description|narration|particulars|details|remarks|note|merchant|payee/.test(n));
  return mapping;
}

export const isMappingComplete = (m: Mapping) =>
  m.date !== -1 && (m.amountMode === "single" ? m.amount !== -1 : m.debit !== -1 && m.credit !== -1);

// An amount with its sign. `labelled` means the cell said Dr or Cr, which settles the direction;
// a bare minus sign only means "the opposite of the plain amounts".
export function parseAmount(raw: string): { value: number; sign: -1 | 0 | 1; labelled: boolean } | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  let sign: -1 | 0 | 1 = 0;
  let labelled = true;
  if (/(^|[\s\d.])(dr|debit)\.?$/.test(s) || /^dr\b/.test(s)) sign = -1;
  else if (/(^|[\s\d.])(cr|credit)\.?$/.test(s) || /^cr\b/.test(s)) sign = 1;
  else {
    labelled = false;
    if (/^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s)) sign = -1;
  }
  s = s
    .replace(/(dr|cr|debit|credit)\.?$|^(dr|cr)\b/g, "")
    .replace(/₹|rs\.?|inr|[,\s()+]/g, "")
    .replace(/^-+|-+$/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  return value > 0 ? { value, sign, labelled } : null;
}

// "CR", "Credit", "income" and so on
export function parseTypeCell(raw: string): TxType | null {
  const s = raw.trim().toLowerCase().replace(/\.$/, "");
  if (/^(cr|c|credit|income|deposit|in|received)$/.test(s)) return "income";
  if (/^(dr|d|debit|expense|withdrawal|out|paid)$/.test(s)) return "expense";
  return null;
}

export type DateOrder = "dmy" | "mdy";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NUMERIC_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/;

const withoutTime = (raw: string) => raw.trim().replace(/(?:T|\s+)\d{1,2}:\d{2}.*$/i, "");

function toDay(year: number, month: number, day: number) {
  const fullYear = year < 100 ? (year < 70 ? 2000 + year : 1900 + year) : year;
  const d = new Date(Date.UTC(fullYear, month - 1, day));
  if (d.getUTCFullYear() !== fullYear || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const monthNumber = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

// A date cell as YYYY-MM-DD, or null. `order` settles dates like 03/04/2026.
export function parseDay(raw: string, order: DateOrder): string | null {
  const s = withoutTime(raw);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return toDay(+m[1], +m[2], +m[3]);
  m = s.match(NUMERIC_DATE);
  if (m) return order === "dmy" ? toDay(+m[3], +m[2], +m[1]) : toDay(+m[3], +m[1], +m[2]);
  m = s.match(/^(\d{1,2})[-\s/.]?([a-z]{3,9})\.?[-\s/.,]*(\d{2}|\d{4})$/i);
  if (m && monthNumber(m[2])) return toDay(+m[3], monthNumber(m[2]), +m[1]);
  m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (m && monthNumber(m[1])) return toDay(+m[3], monthNumber(m[1]), +m[2]);
  return null;
}

// Whether the dates are written day first or month first. `ambiguous` means no date had a part
// above 12, so the user is asked; day first is the default in India.
export function detectDateOrder(values: string[]): { order: DateOrder; numeric: boolean; ambiguous: boolean } {
  let dayFirst = false;
  let monthFirst = false;
  let numeric = false;
  for (const value of values) {
    const m = withoutTime(value).match(NUMERIC_DATE);
    if (!m) continue;
    numeric = true;
    if (+m[1] > 12) dayFirst = true;
    if (+m[2] > 12) monthFirst = true;
  }
  if (monthFirst && !dayFirst) return { order: "mdy", numeric, ambiguous: false };
  return { order: "dmy", numeric, ambiguous: numeric && !dayFirst };
}

export interface ReadOptions {
  dateOrder: DateOrder;
  // For a single amount column without a type or Dr/Cr: what a plain number means. Amounts with a
  // minus sign mean the other: spending on a bank statement, refunds on a credit card one.
  unsignedMeans: TxType;
}

export interface DraftRow {
  // Row number in the file, for messages
  line: number;
  day: string;
  amount: number;
  type: TxType;
  note: string;
  // From the file's category column, if it has one
  category: string;
}

export interface SkippedRow {
  line: number;
  reason: string;
  text: string;
}

// The rows below the headings as transactions, and the ones that couldn't be read with why
export function readRows(grid: Grid, headerRow: number, mapping: Mapping, options: ReadOptions) {
  const rows: DraftRow[] = [];
  const skipped: SkippedRow[] = [];
  const cell = (r: string[], i: number) => (i === -1 ? "" : (r[i] ?? ""));
  grid.slice(headerRow + 1).forEach((r, index) => {
    const line = headerRow + index + 2;
    const skip = (reason: string) => skipped.push({ line, reason, text: r.filter(Boolean).join(" · ").slice(0, 160) });
    const day = parseDay(cell(r, mapping.date), options.dateOrder);
    if (!day) return skip("No date we could read");

    let amount: number;
    let type: TxType;
    if (mapping.amountMode === "split") {
      const out = parseAmount(cell(r, mapping.debit));
      const inn = parseAmount(cell(r, mapping.credit));
      if (out) [amount, type] = [out.value, "expense"];
      else if (inn) [amount, type] = [inn.value, "income"];
      else return skip("No amount");
    } else {
      const parsed = parseAmount(cell(r, mapping.amount));
      if (!parsed) return skip("No amount");
      amount = parsed.value;
      const stated = parseTypeCell(cell(r, mapping.type));
      const opposite: TxType = options.unsignedMeans === "income" ? "expense" : "income";
      if (stated) type = stated;
      else if (parsed.labelled) type = parsed.sign === -1 ? "expense" : "income";
      else type = parsed.sign === -1 ? opposite : options.unsignedMeans;
    }
    if (amount > 1_000_000_000) return skip("Amount is too large");

    rows.push({
      line,
      day,
      amount: Math.round(amount * 100) / 100,
      type,
      note: cell(r, mapping.description).replace(/\s+/g, " ").slice(0, 200),
      category: cell(r, mapping.category).slice(0, 50),
    });
  });
  return { rows, skipped };
}

// What plain amounts most likely mean. Most transactions are spending, so when most amounts have a
// minus sign (a bank statement) plain ones are money in; otherwise (a card statement) they're money out.
export function guessUnsignedMeans(grid: Grid, headerRow: number, column: number): TxType {
  if (column === -1) return "expense";
  let minus = 0;
  let plain = 0;
  for (const r of grid.slice(headerRow + 1)) {
    const parsed = parseAmount(r[column] ?? "");
    if (!parsed || parsed.labelled) continue;
    if (parsed.sign === -1) minus++;
    else plain++;
  }
  return minus > plain ? "income" : "expense";
}

// Common Indian merchants and words, matched as whole words in the description
const RULES: { type: TxType; category: string; words: string[] }[] = [
  { type: "expense", category: "Food", words: ["swiggy", "zomato", "blinkit", "zepto", "instamart", "bigbasket", "dominos", "domino's", "mcdonalds", "kfc", "starbucks", "restaurant", "cafe", "eatsure", "dunzo", "grocery", "groceries"] },
  { type: "expense", category: "Transport", words: ["uber", "ola", "rapido", "irctc", "metro", "petrol", "diesel", "fuel", "hpcl", "bpcl", "iocl", "indian oil", "fastag", "redbus", "indigo", "air india", "akasa", "vistara", "parking"] },
  { type: "expense", category: "Shopping", words: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "decathlon", "dmart", "croma", "reliance digital", "tata cliq", "ikea"] },
  { type: "expense", category: "Bills", words: ["electricity", "bescom", "tata power", "adani", "msedcl", "airtel", "jio", "vodafone", "bsnl", "broadband", "fibernet", "recharge", "dth", "tata play", "water bill", "gas bill", "piped gas", "insurance", "lic"] },
  { type: "expense", category: "Rent", words: ["rent", "nobroker", "house rent"] },
  { type: "expense", category: "Health", words: ["pharmacy", "apollo", "medplus", "1mg", "pharmeasy", "netmeds", "hospital", "clinic", "practo", "diagnostics", "chemist"] },
  { type: "expense", category: "Entertainment", words: ["netflix", "spotify", "hotstar", "prime video", "bookmyshow", "pvr", "inox", "youtube premium", "sonyliv", "zee5", "steam"] },
  { type: "income", category: "Salary", words: ["salary", "payroll", "sal credit"] },
  { type: "income", category: "Freelance", words: ["freelance", "upwork", "fiverr"] },
  { type: "income", category: "Interest", words: ["interest", "int.pd", "int pd", "sb int"] },
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RULE_PATTERNS = RULES.map((rule) => ({
  ...rule,
  pattern: new RegExp(`(^|[^a-z0-9])(${rule.words.map(escapeRegExp).join("|")})([^a-z0-9]|$)`),
}));

// Words in bank descriptions that say nothing about what the money was for
const STOP_WORDS = new Set(
  "upi neft imps rtgs nach ach ecs pos atm txn ref payment paid pay transfer trf from the and for bank ltd pvt private limited india mob mobile via ybl ibl axl okaxis oksbi okicici okhdfcbank paytm icici hdfc sbi axis kotak yes debit credit card online inb net banking withdrawal deposit chq cheque by with upiintent collect request".split(" ")
);

// Lower case, without digits, so "UPI/402918/SWIGGY" and "UPI/518822/SWIGGY" read the same
export const normalizeNote = (note: string) => note.toLowerCase().replace(/\d+/g, "").replace(/\s+/g, " ").trim();

const wordsOf = (note: string) =>
  normalizeNote(note)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

export interface History {
  exact: Map<string, string>;
  words: Map<string, Map<string, number>>;
}

// What the user filed past descriptions under, so the same shop goes to the same category again
export function buildHistory(transactions: { note?: string | null; category: string; type: string }[]): History {
  const history: History = { exact: new Map(), words: new Map() };
  // Oldest first, so the latest choice for an exact description wins
  for (const t of [...transactions].reverse()) {
    if (!t.note?.trim()) continue;
    history.exact.set(`${t.type}:${normalizeNote(t.note)}`, t.category);
    for (const word of new Set(wordsOf(t.note))) {
      const key = `${t.type}:${word}`;
      const counts = history.words.get(key) ?? new Map<string, number>();
      counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      history.words.set(key, counts);
    }
  }
  return history;
}

// The likeliest category for a description: the user's own history first, then common merchants
export function guessCategory(note: string, type: TxType, history: History): string | null {
  if (!note.trim()) return null;
  const exact = history.exact.get(`${type}:${normalizeNote(note)}`);
  if (exact) return exact;

  const scores = new Map<string, number>();
  for (const word of new Set(wordsOf(note))) {
    const counts = history.words.get(`${type}:${word}`);
    if (!counts) continue;
    // A word seen under several categories says less than one always filed the same way
    for (const [category, count] of counts) scores.set(category, (scores.get(category) ?? 0) + count / counts.size);
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [category, score] of scores) {
    if (score > bestScore) [best, bestScore] = [category, score];
  }
  if (best) return best;

  const lower = note.toLowerCase();
  return RULE_PATTERNS.find((rule) => rule.type === type && rule.pattern.test(lower))?.category ?? null;
}

const duplicateKey = (day: string, type: string, amount: number) => `${day}|${type}|${amount.toFixed(2)}`;

// Rows that are probably already saved: the same day, type and amount as an existing entry (each
// entry matches one row), or a repeat of an earlier row in the file with the same description
export function findDuplicates(rows: DraftRow[], existing: { day: string; type: string; amount: number }[]) {
  const saved = new Map<string, number>();
  for (const t of existing) {
    const key = duplicateKey(t.day, t.type, t.amount);
    saved.set(key, (saved.get(key) ?? 0) + 1);
  }
  const seen = new Set<string>();
  return rows.map((row) => {
    const key = duplicateKey(row.day, row.type, row.amount);
    const left = saved.get(key) ?? 0;
    if (left > 0) {
      saved.set(key, left - 1);
      return true;
    }
    const withNote = `${key}|${normalizeNote(row.note)}`;
    if (seen.has(withNote)) return true;
    seen.add(withNote);
    return false;
  });
}

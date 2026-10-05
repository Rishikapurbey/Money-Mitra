// Date arithmetic for monthly and yearly recurring transactions, done in the user's own timezone.
// tzOffset is the client's Date.getTimezoneOffset(): minutes to add to local time to get UTC
// (-330 for India). Entries are stamped at local midday, so no timezone can move them a day.

const MINUTE = 60_000;

export interface LocalDate {
  year: number;
  month: number; // 0-11
  day: number;
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

export function toLocalDate(instant: Date, tzOffset: number): LocalDate {
  const local = new Date(instant.getTime() - tzOffset * MINUTE);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

// The entry for a given month: dayOfMonth, or the month's last day when it's shorter (e.g. the 31st in June)
export function occurrenceIn(year: number, month: number, dayOfMonth: number, tzOffset: number): Date {
  const normalized = new Date(Date.UTC(year, month, 1));
  const y = normalized.getUTCFullYear();
  const m = normalized.getUTCMonth();
  const day = Math.min(dayOfMonth, daysInMonth(y, m));
  return new Date(Date.UTC(y, m, day, 12, 0) + tzOffset * MINUTE);
}

// The first entry on or after the local day containing `from`
export function firstOnOrAfter(from: Date, dayOfMonth: number, tzOffset: number): Date {
  const { year, month, day } = toLocalDate(from, tzOffset);
  const thisMonth = occurrenceIn(year, month, dayOfMonth, tzOffset);
  return toLocalDate(thisMonth, tzOffset).day >= day ? thisMonth : occurrenceIn(year, month + 1, dayOfMonth, tzOffset);
}

// The entry in the month after `occurrence`
export function nextAfter(occurrence: Date, dayOfMonth: number, tzOffset: number): Date {
  const { year, month } = toLocalDate(occurrence, tzOffset);
  return occurrenceIn(year, month + 1, dayOfMonth, tzOffset);
}

export type Frequency = "monthly" | "yearly";

// The entry after `occurrence`: the next month's, or the same date next year
export function nextOccurrence(occurrence: Date, dayOfMonth: number, tzOffset: number, frequency: Frequency = "monthly"): Date {
  if (frequency === "monthly") return nextAfter(occurrence, dayOfMonth, tzOffset);
  const { year, month } = toLocalDate(occurrence, tzOffset);
  return occurrenceIn(year + 1, month, dayOfMonth, tzOffset);
}

// The first entry on or after the local day containing `from`. Yearly ones fall in `monthOfYear`
// (0-11), or in from's month when it isn't given.
export function firstDue(
  from: Date,
  dayOfMonth: number,
  tzOffset: number,
  frequency: Frequency = "monthly",
  monthOfYear: number | null = null
): Date {
  if (frequency === "monthly") return firstOnOrAfter(from, dayOfMonth, tzOffset);
  const today = toLocalDate(from, tzOffset);
  const month = monthOfYear ?? today.month;
  const thisYear = occurrenceIn(today.year, month, dayOfMonth, tzOffset);
  const due = toLocalDate(thisYear, tzOffset);
  const notPassed = due.month > today.month || (due.month === today.month && due.day >= today.day);
  return notPassed ? thisYear : occurrenceIn(today.year + 1, month, dayOfMonth, tzOffset);
}

// Whole local days from `now` until `due`: 0 on the day, negative once it has passed
export function daysUntil(due: Date, now: Date, tzOffset: number): number {
  const a = toLocalDate(now, tzOffset);
  const b = toLocalDate(due, tzOffset);
  return Math.round((Date.UTC(b.year, b.month, b.day) - Date.UTC(a.year, a.month, a.day)) / (24 * 60 * MINUTE));
}

// A safety limit on how many entries one catch-up may add (three years of monthly ones)
const MAX_CATCH_UP = 36;

// Every entry due from nextDue up to now (and not past endDate), plus the new nextDue
export function dueOccurrences(
  nextDue: Date,
  now: Date,
  dayOfMonth: number,
  tzOffset: number,
  endDate: Date | null,
  frequency: Frequency = "monthly"
): { due: Date[]; nextDue: Date } {
  const due: Date[] = [];
  let cursor = nextDue;
  while (cursor <= now && (!endDate || cursor <= endDate) && due.length < MAX_CATCH_UP) {
    due.push(cursor);
    cursor = nextOccurrence(cursor, dayOfMonth, tzOffset, frequency);
  }
  return { due, nextDue: cursor };
}

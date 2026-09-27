// Date arithmetic for monthly recurring transactions, done in the user's own timezone.
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

// A safety limit on how many months one catch-up may add (three years' worth)
const MAX_CATCH_UP = 36;

// Every entry due from nextDue up to now (and not past endDate), plus the new nextDue
export function dueOccurrences(
  nextDue: Date,
  now: Date,
  dayOfMonth: number,
  tzOffset: number,
  endDate: Date | null
): { due: Date[]; nextDue: Date } {
  const due: Date[] = [];
  let cursor = nextDue;
  while (cursor <= now && (!endDate || cursor <= endDate) && due.length < MAX_CATCH_UP) {
    due.push(cursor);
    cursor = nextAfter(cursor, dayOfMonth, tzOffset);
  }
  return { due, nextDue: cursor };
}

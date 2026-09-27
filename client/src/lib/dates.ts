// Local-time YYYY-MM-DD, the format <input type="date"> uses
export const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

// The ISO timestamp to save for a transaction dated `day` (YYYY-MM-DD): the current time for today,
// and midday for other days so a timezone shift can't move it to a neighbouring date
export function transactionTimestamp(day: string) {
  return day === toInputDate(new Date()) ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
}

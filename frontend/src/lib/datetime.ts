// Local-timezone date helpers. Water records are grouped by the user's LOCAL
// calendar date, never a UTC-shifted one.

export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localISOString(d: Date = new Date()): string {
  // ISO-like string preserving local wall-clock time (no Z).
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function monthString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localDateString(d);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function shortDayName(dateStr: string): string {
  return DOW[new Date(dateStr + "T00:00:00").getDay()];
}

export function prettyDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function prettyFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function monthLabel(monthStr: string): string {
  const y = parseInt(monthStr.slice(0, 4), 10);
  const m = parseInt(monthStr.slice(5, 7), 10) - 1;
  return `${MONTHS[m]} ${y}`;
}

export function addMonths(monthStr: string, n: number): string {
  let y = parseInt(monthStr.slice(0, 4), 10);
  let m = parseInt(monthStr.slice(5, 7), 10) - 1 + n;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function timeOfISO(iso?: string | null): string {
  if (!iso) return "";
  // iso like 2026-06-01T08:30:00
  const t = iso.slice(11, 16);
  return t || "";
}

export function timeTo12h(hhmm: string): string {
  if (!hhmm || hhmm.length < 4) return hhmm;
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export const MONTH_NAMES = MONTHS;

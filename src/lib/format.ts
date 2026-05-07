const daysShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const monthsShort = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const DAY_MS = 86_400_000;

/**
 * Format a date as "Hoje", "Ontem", short day-of-week if 2–6 days ago, or
 * "DD mês" otherwise. Mirrors the strings used in the legacy prototype seed.
 */
export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / DAY_MS);

  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff > 1 && diff <= 6) return daysShort[date.getDay()];

  return `${date.getDate()} ${monthsShort[date.getMonth()]}`;
}

/**
 * Time of day as `HH:MM` (24h, zero-padded). Used alongside formatRelativeDate
 * to show "Hoje • 14:32" style metadata so the user can tell same-day items
 * apart by when they were saved.
 */
export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

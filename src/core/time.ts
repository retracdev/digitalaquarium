export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const UNIT: Record<string, number> = {
  s: SECOND,
  sec: SECOND,
  m: MINUTE,
  min: MINUTE,
  h: HOUR,
  hr: HOUR,
  d: DAY,
  day: DAY,
};

/**
 * Parse durations such as "90s", "30m", "2h", "1d", "1h30m" or "1.5h".
 * A bare number is treated as minutes. Returns null when unparseable.
 */
export function parseDuration(input: string): number | null {
  const s = input.replace(/\s+/g, '').toLowerCase();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * MINUTE);
  const part = '(\\d+(?:\\.\\d+)?)(sec|min|hr|day|s|m|h|d)';
  if (!new RegExp(`^(?:${part})+$`).test(s)) return null;
  const re = new RegExp(part, 'g');
  let total = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(s))) total += parseFloat(match[1]) * UNIT[match[2]];
  return total > 0 ? Math.round(total) : null;
}

/** Human friendly countdown, e.g. "1h 05m", "4m 20s", "12s". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return 'now';
  const totalSec = Math.ceil(ms / SECOND);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** "3 hours ago" style relative description. */
export function formatAgo(ms: number): string {
  if (ms < MINUTE) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  return `${Math.floor(ms / DAY)}d ago`;
}

/** Local calendar day key, used for daily streaks. */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Whole local days between two timestamps' calendar dates. */
export function daysBetween(a: number, b: number): number {
  const da = new Date(a);
  const db = new Date(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / DAY);
}

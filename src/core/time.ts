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

// ---------------------------------------------------------------- time zones
//
// The tank's day/night cycle, HUD clock and daily streak all follow a time zone.
// An empty zone means "whatever this browser reports"; players can override it
// in Tank → Care if their browser reports the wrong one.

const formatters = new Map<string, Intl.DateTimeFormat>();

export function detectedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** All zone names the browser knows (falls back to a short list on old browsers). */
export function timeZoneList(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  try {
    if (intl.supportedValuesOf) return intl.supportedValuesOf('timeZone');
  } catch {
    /* fall through */
  }
  return ['UTC', 'America/Los_Angeles', 'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney'];
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Calendar/clock fields of instant `t` in `tz` (empty or invalid → browser zone). */
export function zoned(t: number, tz = ''): ZonedParts {
  const zone = tz && isValidTimeZone(tz) ? tz : '';
  let fmt = formatters.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone || undefined,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatters.set(zone, fmt);
  }
  const out: ZonedParts = { year: 0, month: 0, day: 0, hour: 0, minute: 0 };
  for (const p of fmt.formatToParts(new Date(t))) {
    if (p.type in out) out[p.type as keyof ZonedParts] = Number(p.value);
  }
  out.hour %= 24;
  return out;
}

/** Fractional hour of day (0–24) in `tz`. */
export function hourOfDay(t: number, tz = ''): number {
  const z = zoned(t, tz);
  return z.hour + z.minute / 60;
}

/** "8:46 PM"-style clock in `tz`. */
export function formatClock(t: number, tz = ''): string {
  const zone = tz && isValidTimeZone(tz) ? tz : undefined;
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: zone });
}

/** Calendar day key in `tz`, used for daily streaks. */
export function dayKey(t: number, tz = ''): string {
  const z = zoned(t, tz);
  return `${z.year}-${z.month}-${z.day}`;
}

/** Whole calendar days from day key `a` to day key `b`. */
export function daysBetweenKeys(a: string, b: string): number {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / DAY);
}

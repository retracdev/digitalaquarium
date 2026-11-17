export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Short unique-enough id for save entities (kept short to save cookie bytes). */
export function uid(rng: Rng = defaultRng): string {
  let s = '';
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 7; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

export function pick<T>(items: readonly T[], rng: Rng = defaultRng): T {
  return items[Math.floor(rng() * items.length)];
}

export function weightedPick<T>(items: readonly { item: T; weight: number }[], rng: Rng = defaultRng): T {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const entry of items) {
    r -= entry.weight;
    if (r <= 0) return entry.item;
  }
  return items[items.length - 1].item;
}

/** Deterministic PRNG (mulberry32) — handy for tests and stable visuals. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit seed. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

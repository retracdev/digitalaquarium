/**
 * Minimal chunked cookie store. Browsers cap a single cookie at ~4KB, so larger
 * values are split across `name.0`, `name.1`, ... with the chunk count kept in `name.n`.
 */
export const CHUNK_SIZE = 3600;
const MAX_AGE = 60 * 60 * 24 * 400; // ~400 days, the max modern browsers allow

export interface CookieJar {
  get cookie(): string;
  set cookie(v: string);
}

export class ChunkedCookieStore {
  constructor(
    private readonly jar: CookieJar = document,
    private readonly prefix = 'daq_',
  ) {}

  private all(): Map<string, string> {
    const map = new Map<string, string>();
    const raw = this.jar.cookie;
    if (!raw) return map;
    for (const part of raw.split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      map.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }
    return map;
  }

  private write(name: string, value: string, maxAge = MAX_AGE): void {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    this.jar.cookie = `${this.prefix}${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  }

  /** Value must already be cookie-safe (e.g. encodeURIComponent output). */
  set(name: string, value: string): void {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    const previous = this.chunkCount(name);
    chunks.forEach((c, i) => this.write(`${name}.${i}`, c));
    this.write(`${name}.n`, String(chunks.length));
    for (let i = chunks.length; i < previous; i++) this.write(`${name}.${i}`, '', 0);
  }

  get(name: string): string | null {
    const cookies = this.all();
    const n = Number(cookies.get(`${this.prefix}${name}.n`));
    if (!Number.isInteger(n) || n <= 0) return null;
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = cookies.get(`${this.prefix}${name}.${i}`);
      if (part === undefined) return null; // a chunk went missing: treat as corrupt
      out += part;
    }
    return out;
  }

  remove(name: string): void {
    const n = this.chunkCount(name);
    for (let i = 0; i < n; i++) this.write(`${name}.${i}`, '', 0);
    this.write(`${name}.n`, '', 0);
  }

  /** Simple single-cookie values (e.g. the last used slot). */
  setRaw(name: string, value: string): void {
    this.write(name, value);
  }

  getRaw(name: string): string | null {
    return this.all().get(`${this.prefix}${name}`) ?? null;
  }

  private chunkCount(name: string): number {
    const n = Number(this.all().get(`${this.prefix}${name}.n`));
    return Number.isInteger(n) && n > 0 ? n : 0;
  }
}

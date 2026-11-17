import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { migrate, SLOT_COUNT, summarize, type SaveData, type SlotSummary } from '../core/state';
import { ChunkedCookieStore, type CookieJar } from './cookies';

/**
 * Where saves live. Cookies today; a cloud backend (account sync, live-with-friends)
 * can implement the same interface later and be swapped in, or layered on top.
 */
export interface SaveBackend {
  readonly id: string;
  load(slot: number): SaveData | null;
  save(slot: number, data: SaveData): void;
  remove(slot: number): void;
  list(): (SlotSummary | { slot: number; empty: true } | { slot: number; corrupt: true })[];
  getActiveSlot(): number | null;
  setActiveSlot(slot: number): void;
}

export function encodeSave(data: SaveData): string {
  return compressToEncodedURIComponent(JSON.stringify(data));
}

export function decodeSave(raw: string): SaveData | null {
  try {
    const json = decompressFromEncodedURIComponent(raw);
    if (!json) return null;
    return migrate(JSON.parse(json));
  } catch {
    return null;
  }
}

const assertSlot = (slot: number) => {
  if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_COUNT) throw new Error(`Invalid save slot ${slot}`);
};

export class CookieSaveBackend implements SaveBackend {
  readonly id = 'cookies';
  private store: ChunkedCookieStore;

  constructor(jar?: CookieJar) {
    this.store = new ChunkedCookieStore(jar);
  }

  load(slot: number): SaveData | null {
    assertSlot(slot);
    const raw = this.store.get(`s${slot}`);
    return raw ? decodeSave(raw) : null;
  }

  save(slot: number, data: SaveData): void {
    assertSlot(slot);
    this.store.set(`s${slot}`, encodeSave(data));
  }

  remove(slot: number): void {
    assertSlot(slot);
    this.store.remove(`s${slot}`);
    if (this.getActiveSlot() === slot) this.store.setRaw('active', '');
  }

  list() {
    const out: ReturnType<SaveBackend['list']> = [];
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const raw = this.store.get(`s${slot}`);
      if (!raw) {
        out.push({ slot, empty: true });
        continue;
      }
      const data = decodeSave(raw);
      out.push(data ? summarize(slot, data) : { slot, corrupt: true });
    }
    return out;
  }

  getActiveSlot(): number | null {
    const n = Number(this.store.getRaw('active'));
    return Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT ? n : null;
  }

  setActiveSlot(slot: number): void {
    assertSlot(slot);
    this.store.setRaw('active', String(slot));
  }
}

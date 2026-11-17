import * as A from '../core/actions';
import { runCommand, type ConsoleOutput } from '../core/devconsole';
import { simulate } from '../core/sim';
import { createNewSave, type SaveData, type SimEvent } from '../core/state';
import type { SaveBackend } from '../storage/saves';

export type ControllerEvent =
  | { type: 'state' }
  | { type: 'events'; events: SimEvent[]; away: boolean }
  | { type: 'toast'; text: string; tone: 'good' | 'bad' | 'info' | 'warn' }
  | { type: 'action'; name: string; data?: unknown }
  | { type: 'slot'; slot: number }
  | { type: 'saved' };

type Listener = (e: ControllerEvent) => void;

/** Owns the active save: ticking, actions, autosave and slot switching. */
export class AquariumController {
  save!: SaveData;
  slot = 0;
  /** Bumped whenever the set of entities changes (renderer re-syncs on change). */
  version = 0;
  private listeners = new Set<Listener>();
  private dirty = false;
  private lastSaveAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(readonly backend: SaveBackend) {}

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: ControllerEvent) {
    for (const l of this.listeners) l(e);
  }

  now(): number {
    return Date.now() + (this.save?.timeOffset ?? 0);
  }

  get loaded(): boolean {
    return this.slot > 0;
  }

  /** Load (or create) a slot, catch the simulation up, and start ticking. */
  open(slot: number, newName?: string): void {
    if (this.loaded) this.flush();
    let data = newName === undefined ? this.backend.load(slot) : null;
    if (!data) data = createNewSave(newName ?? `Tank ${slot}`, Date.now());
    this.save = data;
    this.slot = slot;
    this.backend.setActiveSlot(slot);
    const away = this.now() - data.lastTick;
    const events = [...simulate(data, this.now()), ...A.checkDaily(data, this.now())];
    this.version++;
    this.dirty = true;
    this.persist();
    this.emit({ type: 'slot', slot });
    this.emit({ type: 'state' });
    if (events.length) this.emit({ type: 'events', events, away: away > 5 * 60_000 });
    this.start();
  }

  /** Force-save the current slot (used on slot switch, tab hide and unload). */
  flush(): void {
    this.dirty = true;
    this.persist();
  }

  close(): void {
    this.flush();
    this.stop();
    this.slot = 0;
  }

  createSlot(slot: number, name: string): void {
    this.open(slot, name);
  }

  deleteSlot(slot: number): void {
    this.backend.remove(slot);
    if (slot === this.slot) {
      this.stop();
      this.slot = 0;
    }
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(): void {
    if (!this.loaded) return;
    const before = this.entityCount();
    const events = [...simulate(this.save, this.now()), ...A.checkDaily(this.save, this.now())];
    this.dirty = true;
    if (this.entityCount() !== before) this.version++;
    if (events.length) this.emit({ type: 'events', events, away: false });
    this.emit({ type: 'state' });
    if (Date.now() - this.lastSaveAt > 15_000) this.persist();
  }

  private entityCount(): string {
    const s = this.save;
    return `${s.fish.length}|${s.plants.length}|${s.decor.length}|${s.eggs.length}|${s.upgrades.tank}|${s.theme}`;
  }

  persist(): void {
    if (!this.loaded || !this.dirty) return;
    this.save.updatedAt = Date.now();
    try {
      this.backend.save(this.slot, this.save);
      this.lastSaveAt = Date.now();
      this.dirty = false;
      this.emit({ type: 'saved' });
    } catch (err) {
      console.error('Save failed', err);
      this.emit({ type: 'toast', text: 'Could not save — are cookies blocked?', tone: 'bad' });
    }
  }

  /** Run an action, surface its message and events, bump version, save soon. */
  run(name: string, fn: (save: SaveData, now: number) => A.ActionResult, data?: unknown): A.ActionResult {
    const result = fn(this.save, this.now());
    if (result.ok) {
      this.version++;
      this.dirty = true;
      this.emit({ type: 'action', name, data: data ?? result });
      this.persist();
    }
    if (result.msg) this.emit({ type: 'toast', text: result.msg, tone: result.ok ? 'good' : 'warn' });
    if (result.events.length) this.emit({ type: 'events', events: result.events, away: false });
    this.emit({ type: 'state' });
    return result;
  }

  feed = () => this.run('feed', A.feed);
  clean = () => this.run('clean', A.clean);
  collect = () => this.run('collect', A.collectShells);
  buyEgg = (id: string) => this.run('buyEgg', (s, n) => A.buyEgg(s, id, n));
  hatch = (eggId: string) => this.run('hatch', (s, n) => A.hatchEgg(s, eggId, n));
  buyPlant = (type: string, x: number, z: number) => this.run('buyPlant', (s, n) => A.buyPlant(s, type, x, z, n));
  buyDecor = (type: string, x: number, z: number, rot: number) => this.run('buyDecor', (s, n) => A.buyDecor(s, type, x, z, rot, n));
  move = (id: string, x: number, z: number) => this.run('move', (s, n) => A.moveItem(s, id, x, z, n));
  remove = (id: string) => this.run('remove', (s, n) => A.removeItem(s, id, n));
  rehome = (id: string) => this.run('rehome', (s, n) => A.rehomeFish(s, id, n), { id });
  rename = (id: string, name: string) => this.run('rename', (s, n) => A.renameFish(s, id, name, n));
  openChest = (id: string) => this.run('chest', (s, n) => A.openChest(s, id, n), { id });
  upgrade = (kind: 'filter' | 'tank' | 'feeder') => this.run('upgrade', (s, n) => A.buyUpgrade(s, kind, n));
  refill = () => this.run('refill', A.refillFeeder);
  medicine = () => this.run('medicine', A.giveMedicine);
  theme = (id: string) => this.run('theme', (s, n) => A.buyTheme(s, id, n));
  lights = (mode: 'auto' | 'day' | 'night') => this.run('lights', (s, n) => A.setLights(s, mode, n));
  renameTank = (name: string) => this.run('renameTank', (s, n) => A.renameTank(s, name, n));

  /** Secret console entry point. */
  command(input: string): ConsoleOutput {
    if (!this.loaded) return { lines: ['Open a save slot first.'], changed: false };
    const result = runCommand(
      {
        save: this.save,
        now: () => this.now(),
        resync: () => {
          const events = simulate(this.save, this.now());
          if (events.length) this.emit({ type: 'events', events, away: false });
          return events;
        },
      },
      input,
    );
    if (result.changed) {
      this.version++;
      this.dirty = true;
      this.persist();
      this.emit({ type: 'state' });
    }
    return result;
  }
}

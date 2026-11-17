import { STARTER_EGG_MS, SPECIES_BY_ID } from './catalog';
import { uid, type Rng, defaultRng } from './rng';
import { randomFishName } from './names';
import { HOUR } from './time';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 5;

export type Tone = 'good' | 'bad' | 'info' | 'warn';

export interface SimEvent {
  kind:
    | 'levelUp'
    | 'fishDied'
    | 'eggReady'
    | 'plantMature'
    | 'upgradeDone'
    | 'chestReady'
    | 'hungry'
    | 'starving'
    | 'sick'
    | 'waterMurky'
    | 'waterFilthy'
    | 'achievement'
    | 'fishGrown'
    | 'autoFeed'
    | 'feederEmpty'
    | 'daily'
    | 'info';
  text: string;
  at: number;
  tone: Tone;
  refId?: string;
}

export interface Fish {
  id: string;
  species: string;
  name: string;
  bornAt: number;
  /** 0 = full, 100 = starving */
  hunger: number;
  /** 0 = dead, 100 = perfect */
  health: number;
  /** 0..100 */
  happiness: number;
}

export interface Plant {
  id: string;
  type: string;
  plantedAt: number;
  /** tank-normalised floor coordinates in [-0.5, 0.5] */
  x: number;
  z: number;
  matured?: boolean;
}

export interface Decor {
  id: string;
  type: string;
  x: number;
  z: number;
  rot: number;
  /** treasure chests: next time loot is ready */
  lootAt?: number;
}

export interface Egg {
  id: string;
  species: string;
  laidAt: number;
  hatchAt: number;
  notified?: boolean;
}

export type UpgradeKind = 'filter' | 'tank' | 'feeder';

export interface PendingUpgrade {
  kind: UpgradeKind;
  tier: number;
  readyAt: number;
}

export interface Memorial {
  name: string;
  species: string;
  bornAt: number;
  diedAt: number;
  cause: 'starvation' | 'water';
}

export interface Stats {
  fed: number;
  cleaned: number;
  hatched: number;
  shellsEarned: number;
  fishLost: number;
  chestsOpened: number;
  rehomed: number;
}

export type LightMode = 'auto' | 'day' | 'night';

export interface SaveData {
  v: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** simulation time last processed */
  lastTick: number;
  /** dev offset added to the wall clock (time-warp) */
  timeOffset: number;
  shells: number;
  pendingShells: number;
  xp: number;
  level: number;
  /** water cleanliness 0..100 */
  water: number;
  fish: Fish[];
  plants: Plant[];
  decor: Decor[];
  eggs: Egg[];
  upgrades: Record<UpgradeKind, number>;
  pending: PendingUpgrade[];
  feederPortions: number;
  theme: string;
  themesOwned: string[];
  lights: LightMode;
  stats: Stats;
  memorial: Memorial[];
  achievements: string[];
  log: SimEvent[];
  streak: number;
  lastVisitDay: string;
  /** flags used to avoid repeating warnings */
  flags: Record<string, boolean>;
  /** Tutorial step in progress (0+), or TUTORIAL_DONE once finished/skipped. */
  tutorial: number;
}

export const TUTORIAL_DONE = -1;
/** Starter fish arrive a little peckish so the very first feed is a satisfying one. */
export const STARTER_HUNGER = 45;

export function emptyStats(): Stats {
  return { fed: 0, cleaned: 0, hatched: 0, shellsEarned: 0, fishLost: 0, chestsOpened: 0, rehomed: 0 };
}

export function newFish(species: string, now: number, rng: Rng = defaultRng, grown = false): Fish {
  const def = SPECIES_BY_ID.get(species);
  const growMs = def ? def.growMs : 2 * HOUR;
  return {
    id: uid(rng),
    species,
    name: randomFishName(rng),
    // pre-grown fish are born well before adulthood so no 'grown up' event fires
    bornAt: grown ? now - growMs * 1.5 : now,
    hunger: 20,
    health: 100,
    happiness: 70,
  };
}

/** A brand new tank with a tiny welcome kit so there is something alive from second one. */
export function createNewSave(name: string, now: number, rng: Rng = defaultRng): SaveData {
  return {
    v: SAVE_VERSION,
    name: name.trim().slice(0, 24) || 'My Aquarium',
    createdAt: now,
    updatedAt: now,
    lastTick: now,
    timeOffset: 0,
    shells: 120,
    pendingShells: 0,
    xp: 0,
    level: 1,
    water: 92,
    fish: [0, 1, 2].map(() => ({ ...newFish('neon_tetra', now, rng, true), hunger: STARTER_HUNGER })),
    plants: [
      { id: uid(rng), type: 'java_fern', plantedAt: now - 2 * HOUR, x: -0.32, z: -0.22, matured: true },
      { id: uid(rng), type: 'eelgrass', plantedAt: now - 2 * HOUR, x: 0.3, z: -0.28, matured: true },
    ],
    decor: [{ id: uid(rng), type: 'rocks', x: 0.05, z: -0.1, rot: 0.6 }],
    eggs: [{ id: uid(rng), species: 'guppy', laidAt: now, hatchAt: now + STARTER_EGG_MS }],
    upgrades: { filter: 0, tank: 0, feeder: 0 },
    pending: [],
    feederPortions: 0,
    theme: 'lagoon',
    themesOwned: ['lagoon'],
    lights: 'auto',
    stats: emptyStats(),
    memorial: [],
    achievements: [],
    log: [],
    streak: 1,
    lastVisitDay: '',
    flags: {},
    tutorial: 0,
  };
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Normalise anything loaded from storage into a valid SaveData. Unknown fields are
 * dropped, missing fields get defaults. Returns null if it isn't a save at all.
 */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.v !== 'number' || typeof r.createdAt !== 'number') return null;
  const base = createNewSave(str(r.name, 'My Aquarium'), num(r.createdAt, Date.now()));
  const stats = { ...emptyStats(), ...((r.stats as object) ?? {}) } as Stats;
  const upgrades = { ...base.upgrades, ...((r.upgrades as object) ?? {}) } as Record<UpgradeKind, number>;
  return {
    ...base,
    v: SAVE_VERSION,
    updatedAt: num(r.updatedAt, base.createdAt),
    lastTick: num(r.lastTick, base.createdAt),
    timeOffset: num(r.timeOffset, 0),
    shells: num(r.shells, 0),
    pendingShells: num(r.pendingShells, 0),
    xp: num(r.xp, 0),
    level: Math.max(1, Math.floor(num(r.level, 1))),
    water: num(r.water, 80),
    fish: arr<Fish>(r.fish).filter((f) => f && SPECIES_BY_ID.has(f.species)),
    plants: arr<Plant>(r.plants).filter((p) => p && typeof p.type === 'string'),
    decor: arr<Decor>(r.decor).filter((d) => d && typeof d.type === 'string'),
    eggs: arr<Egg>(r.eggs).filter((e) => e && typeof e.hatchAt === 'number'),
    upgrades,
    pending: arr<PendingUpgrade>(r.pending),
    feederPortions: num(r.feederPortions, 0),
    theme: str(r.theme, 'lagoon'),
    themesOwned: arr<string>(r.themesOwned).length ? arr<string>(r.themesOwned) : ['lagoon'],
    lights: (['auto', 'day', 'night'] as const).includes(r.lights as LightMode) ? (r.lights as LightMode) : 'auto',
    stats,
    memorial: arr<Memorial>(r.memorial),
    achievements: arr<string>(r.achievements),
    log: arr<SimEvent>(r.log),
    streak: num(r.streak, 1),
    lastVisitDay: str(r.lastVisitDay, ''),
    flags: (r.flags && typeof r.flags === 'object' ? r.flags : {}) as Record<string, boolean>,
    // Saves from before the tutorial existed shouldn't suddenly start one.
    tutorial: Math.floor(num(r.tutorial, TUTORIAL_DONE)),
  };
}

export interface SlotSummary {
  slot: number;
  name: string;
  level: number;
  fish: number;
  updatedAt: number;
  hungry: number;
}

export function summarize(slot: number, save: SaveData): SlotSummary {
  return {
    slot,
    name: save.name,
    level: save.level,
    fish: save.fish.length,
    updatedAt: save.updatedAt,
    hungry: save.fish.filter((f) => f.hunger >= 70).length,
  };
}

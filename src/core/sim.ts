import {
  DECOR_BY_ID,
  FEEDER_TIERS,
  FILTER_TIERS,
  PLANTS_BY_ID,
  SPECIES_BY_ID,
  TANK_TIERS,
} from './catalog';
import { checkAchievements, grantXp, pushEvent } from './progress';
import { clamp } from './rng';
import type { Fish, Plant, SaveData, SimEvent } from './state';
import { HOUR, MINUTE } from './time';

/** Hunger thresholds (0 = full, 100 = starving). */
export const HUNGRY = 70;
export const STARVING = 100;
/** Feeding knocks this much hunger off every fish. */
export const FEED_AMOUNT = 55;
/** Feeding while everyone's average hunger is below this overfeeds (dirties water). */
export const OVERFEED_BELOW = 22;
export const OVERFEED_WATER_PENALTY = 6;
/** Health lost per hour while starving: a full fish survives ~12h before starving, then ~16h more. */
export const STARVE_DAMAGE = 6;
export const MAX_STEP = 10 * MINUTE;
export const AUTO_FEED_AT = 65;

export function fishGrowth(fish: Fish, now: number): number {
  const def = SPECIES_BY_ID.get(fish.species);
  if (!def) return 1;
  return clamp((now - fish.bornAt) / def.growMs, 0, 1);
}

export function plantProgress(plant: Plant, now: number): number {
  const def = PLANTS_BY_ID.get(plant.type);
  if (!def) return 1;
  return clamp((now - plant.plantedAt) / def.growMs, 0, 1);
}

export interface TankStats {
  load: number;
  capacity: number;
  decayPerHour: number;
  cleanPerHour: number;
  decorScore: number;
  plantScore: number;
  filterMult: number;
  oxygenMult: number;
}

export function fishLoad(save: SaveData): number {
  return save.fish.reduce((sum, f) => sum + (SPECIES_BY_ID.get(f.species)?.bioload ?? 1), 0);
}

export function tankStats(save: SaveData, now: number): TankStats {
  const load = fishLoad(save);
  const capacity = TANK_TIERS[save.upgrades.tank]?.capacity ?? TANK_TIERS[0].capacity;
  const filterMult = FILTER_TIERS[save.upgrades.filter]?.decayMult ?? 1;
  let oxygenMult = 1;
  let decorScore = 0;
  for (const d of save.decor) {
    const def = DECOR_BY_ID.get(d.type);
    if (!def) continue;
    decorScore += def.happiness;
    if (def.oxygen) oxygenMult *= def.oxygen;
  }
  oxygenMult = Math.max(0.55, oxygenMult);
  let cleanPerHour = 0;
  let plantScore = 0;
  for (const p of save.plants) {
    const def = PLANTS_BY_ID.get(p.type);
    if (!def) continue;
    const prog = plantProgress(p, now);
    cleanPerHour += def.cleanPerHour * prog;
    plantScore += def.happiness * prog;
  }
  const decayPerHour = (0.6 + 0.35 * load) * filterMult * oxygenMult;
  return { load, capacity, decayPerHour, cleanPerHour, decorScore, plantScore, filterMult, oxygenMult };
}

export function pendingCap(save: SaveData): number {
  return 150 + 40 * save.level;
}

export function feederCapacity(save: SaveData): number {
  return FEEDER_TIERS[save.upgrades.feeder]?.portions ?? 0;
}

export function targetHappiness(fish: Fish, save: SaveData, stats: TankStats): number {
  let t = 55;
  t += Math.min(25, stats.decorScore);
  t += Math.min(20, stats.plantScore);
  t -= Math.max(0, fish.hunger - 40) * 0.9;
  t -= Math.max(0, 70 - save.water) * 0.8;
  if (fish.health < 50) t -= (50 - fish.health) * 0.5;
  // Schoolers like company; anemone-lovers like anemones.
  const def = SPECIES_BY_ID.get(fish.species);
  if (def?.behavior === 'school') {
    const friends = save.fish.filter((f) => f.species === fish.species).length;
    t += friends >= 4 ? 6 : friends >= 2 ? 0 : -10;
  }
  if (fish.species === 'clownfish' && save.plants.some((p) => p.type === 'anemone')) t += 10;
  return clamp(t, 0, 100);
}

/** Pure state feed: used by the Feed button and the auto-feeder. */
export function applyFeed(save: SaveData): { overfed: boolean } {
  const avg = save.fish.length ? save.fish.reduce((a, f) => a + f.hunger, 0) / save.fish.length : 0;
  const overfed = avg < OVERFEED_BELOW;
  for (const f of save.fish) f.hunger = Math.max(0, f.hunger - FEED_AMOUNT);
  if (overfed) save.water = Math.max(0, save.water - OVERFEED_WATER_PENALTY);
  return { overfed };
}

function nameList(fish: Fish[]): string {
  if (fish.length === 1) return fish[0].name;
  if (fish.length === 2) return `${fish[0].name} and ${fish[1].name}`;
  return `${fish[0].name} and ${fish.length - 1} others`;
}

function step(save: SaveData, t: number, dtH: number, events: SimEvent[]): void {
  // Upgrades finishing installation.
  for (const up of [...save.pending]) {
    if (up.readyAt > t) continue;
    save.pending = save.pending.filter((p) => p !== up);
    save.upgrades[up.kind] = up.tier;
    const tierName =
      up.kind === 'filter' ? FILTER_TIERS[up.tier].name : up.kind === 'tank' ? TANK_TIERS[up.tier].name : FEEDER_TIERS[up.tier].name;
    if (up.kind === 'feeder') save.feederPortions = FEEDER_TIERS[up.tier].portions;
    pushEvent(save, events, { kind: 'upgradeDone', at: up.readyAt, tone: 'good', text: `${tierName} installed!` });
    grantXp(save, 25, up.readyAt, events);
  }

  for (const egg of save.eggs) {
    if (!egg.notified && egg.hatchAt <= t) {
      egg.notified = true;
      const name = egg.species === 'mystery' ? 'Mystery Egg' : SPECIES_BY_ID.get(egg.species)?.name ?? 'An egg';
      pushEvent(save, events, { kind: 'eggReady', at: egg.hatchAt, tone: 'good', text: `${name} is ready to hatch!`, refId: egg.id });
    }
  }

  for (const p of save.plants) {
    if (!p.matured && plantProgress(p, t) >= 1) {
      p.matured = true;
      const def = PLANTS_BY_ID.get(p.type);
      pushEvent(save, events, { kind: 'plantMature', at: t, tone: 'good', text: `${def?.name ?? 'A plant'} is fully grown.`, refId: p.id });
      grantXp(save, def?.xp ?? 5, t, events);
    }
  }

  for (const d of save.decor) {
    if (d.lootAt !== undefined && d.lootAt <= t && !save.flags[`chest:${d.id}`]) {
      save.flags[`chest:${d.id}`] = true;
      pushEvent(save, events, { kind: 'chestReady', at: d.lootAt, tone: 'good', text: 'A treasure chest is full of loot!', refId: d.id });
    }
  }

  const stats = tankStats(save, t);

  // Auto-feeder kicks in before anyone gets too hungry.
  if (save.upgrades.feeder > 0 && save.fish.length) {
    const maxHunger = Math.max(...save.fish.map((f) => f.hunger));
    if (maxHunger >= AUTO_FEED_AT) {
      if (save.feederPortions > 0) {
        save.feederPortions--;
        applyFeed(save);
        pushEvent(save, events, { kind: 'autoFeed', at: t, tone: 'info', text: `Auto-feeder dispensed food (${save.feederPortions} left).` });
        if (save.feederPortions === 0)
          pushEvent(save, events, { kind: 'feederEmpty', at: t, tone: 'warn', text: 'The auto-feeder is empty. Refill it in the Tank panel.' });
      }
    }
  }

  // Water.
  const prevWater = save.water;
  save.water = clamp(save.water - stats.decayPerHour * dtH + stats.cleanPerHour * dtH, 0, 100);
  if (prevWater >= 50 && save.water < 50)
    pushEvent(save, events, { kind: 'waterMurky', at: t, tone: 'warn', text: 'The water is getting murky. Give the tank a clean.' });
  if (prevWater >= 25 && save.water < 25)
    pushEvent(save, events, { kind: 'waterFilthy', at: t, tone: 'bad', text: 'The water is filthy! Your fish are getting sick.' });

  // Fish.
  const newlyHungry: Fish[] = [];
  const newlyStarving: Fish[] = [];
  const newlySick: Fish[] = [];
  const dead: Fish[] = [];
  let income = 0;
  for (const f of save.fish) {
    const def = SPECIES_BY_ID.get(f.species)!;
    const prevHunger = f.hunger;
    const prevHealth = f.health;
    const prevGrowth = fishGrowth(f, t - dtH * HOUR);
    f.hunger = clamp(f.hunger + def.hungerPerHour * dtH, 0, 100);
    if (prevHunger < HUNGRY && f.hunger >= HUNGRY) newlyHungry.push(f);
    if (prevHunger < STARVING && f.hunger >= STARVING) newlyStarving.push(f);

    let dh = 0;
    if (f.hunger >= STARVING) dh -= STARVE_DAMAGE;
    if (save.water < 30) dh -= (30 - save.water) * 0.15;
    if (f.hunger < 80 && save.water >= 40) dh += 5;
    f.health = clamp(f.health + dh * dtH, 0, 100);
    if (prevHealth >= 40 && f.health < 40) newlySick.push(f);

    const target = targetHappiness(f, save, stats);
    const rate = 20 * dtH;
    f.happiness = f.happiness < target ? Math.min(target, f.happiness + rate) : Math.max(target, f.happiness - rate);

    const growth = fishGrowth(f, t);
    if (prevGrowth < 1 && growth >= 1) {
      pushEvent(save, events, { kind: 'fishGrown', at: t, tone: 'good', text: `${f.name} the ${def.name} is all grown up!`, refId: f.id });
    }
    if (growth >= 1 && f.happiness >= 40) income += def.shellsPerHour * (0.5 + f.happiness / 200) * dtH;
    if (f.health <= 0) dead.push(f);
  }

  if (newlyHungry.length)
    pushEvent(save, events, { kind: 'hungry', at: t, tone: 'warn', text: `${nameList(newlyHungry)} ${newlyHungry.length > 1 ? 'are' : 'is'} getting hungry.` });
  if (newlyStarving.length)
    pushEvent(save, events, { kind: 'starving', at: t, tone: 'bad', text: `${nameList(newlyStarving)} ${newlyStarving.length > 1 ? 'are' : 'is'} starving! Feed them soon.` });
  const sickAlive = newlySick.filter((f) => !dead.includes(f));
  if (sickAlive.length)
    pushEvent(save, events, { kind: 'sick', at: t, tone: 'bad', text: `${nameList(sickAlive)} ${sickAlive.length > 1 ? 'are' : 'is'} getting weak.` });

  for (const f of dead) {
    const def = SPECIES_BY_ID.get(f.species)!;
    const cause = f.hunger >= STARVING ? 'starvation' : 'water';
    save.fish = save.fish.filter((x) => x !== f);
    save.memorial.push({ name: f.name, species: f.species, bornAt: f.bornAt, diedAt: t, cause });
    if (save.memorial.length > 40) save.memorial.shift();
    save.stats.fishLost++;
    pushEvent(save, events, {
      kind: 'fishDied',
      at: t,
      tone: 'bad',
      refId: f.id,
      text: `${f.name} the ${def.name} passed away (${cause === 'starvation' ? 'starvation' : 'dirty water'}).`,
    });
  }

  for (const p of save.plants) {
    if (!p.matured) continue;
    income += (PLANTS_BY_ID.get(p.type)?.shellsPerHour ?? 0) * dtH;
  }
  save.pendingShells = Math.min(pendingCap(save), save.pendingShells + income);
}

/**
 * Advance the tank from save.lastTick to `to`. Works for both the live 1-second
 * tick and catching up after days away. Returns the events that happened.
 */
export function simulate(save: SaveData, to: number): SimEvent[] {
  const events: SimEvent[] = [];
  let t = save.lastTick;
  if (to <= t) return events;
  while (t < to) {
    const dt = Math.min(MAX_STEP, to - t);
    t += dt;
    step(save, t, dt / HOUR, events);
  }
  save.lastTick = to;
  checkAchievements(save, to, events);
  return events;
}

import {
  DECOR_BY_ID,
  FEEDER_PORTION_COST,
  FEEDER_TIERS,
  FILTER_TIERS,
  MEDICINE_COST,
  MEDICINE_UNLOCK,
  MYSTERY_EGG,
  PLANTS_BY_ID,
  RARITY_WEIGHT,
  SPECIES,
  SPECIES_BY_ID,
  TANK_TIERS,
  THEMES_BY_ID,
  hatcherySlots,
  type TierDef,
} from './catalog';
import { checkAchievements, grantXp, pushEvent } from './progress';
import { clamp, defaultRng, uid, weightedPick, type Rng } from './rng';
import { applyFeed, feederCapacity, fishGrowth, fishLoad, HUNGRY, tankStats } from './sim';
import { newFish, type Fish, type LightMode, type SaveData, type SimEvent, type UpgradeKind } from './state';
import { dayKey, daysBetween } from './time';

export interface ActionResult {
  ok: boolean;
  msg: string;
  events: SimEvent[];
  /** Optional payload, e.g. the newly hatched fish. */
  fish?: Fish;
  shells?: number;
}

const fail = (msg: string): ActionResult => ({ ok: false, msg, events: [] });

function finish(save: SaveData, now: number, msg: string, events: SimEvent[], extra: Partial<ActionResult> = {}): ActionResult {
  checkAchievements(save, now, events);
  save.updatedAt = now;
  return { ok: true, msg, events, ...extra };
}

export function feed(save: SaveData, now: number): ActionResult {
  if (!save.fish.length) return fail('There are no fish to feed yet.');
  const events: SimEvent[] = [];
  const hungry = save.fish.filter((f) => f.hunger >= 30).length;
  const { overfed } = applyFeed(save);
  save.stats.fed++;
  if (overfed) return finish(save, now, 'Your fish were not hungry — leftover food is clouding the water.', events);
  grantXp(save, 3 + hungry, now, events);
  return finish(save, now, hungry ? `Fed ${save.fish.length} fish. Nom nom.` : 'Fed the fish.', events);
}

export function clean(save: SaveData, now: number): ActionResult {
  if (save.water >= 99) return fail('The water is already crystal clear.');
  const events: SimEvent[] = [];
  const dirt = 100 - save.water;
  save.water = 100;
  save.stats.cleaned++;
  if (dirt >= 15) grantXp(save, Math.round(dirt / 8), now, events);
  return finish(save, now, 'Sparkling clean!', events);
}

export function collectShells(save: SaveData, now: number): ActionResult {
  const amount = Math.floor(save.pendingShells);
  if (amount < 1) return fail('Nothing to collect yet — happy, grown fish make shells over time.');
  const events: SimEvent[] = [];
  save.shells += amount;
  save.pendingShells -= amount;
  save.stats.shellsEarned += amount;
  grantXp(save, Math.floor(amount / 10), now, events);
  return finish(save, now, `Collected ${amount} shells.`, events, { shells: amount });
}

export function buyEgg(save: SaveData, speciesId: string, now: number, rng: Rng = defaultRng): ActionResult {
  const isMystery = speciesId === MYSTERY_EGG.id;
  const def = isMystery ? null : SPECIES_BY_ID.get(speciesId);
  if (!isMystery && !def) return fail('Unknown species.');
  const unlock = isMystery ? MYSTERY_EGG.unlockLevel : def!.unlockLevel;
  const cost = isMystery ? MYSTERY_EGG.cost : def!.cost;
  const hatchMs = isMystery ? MYSTERY_EGG.hatchMs : def!.hatchMs;
  if (save.level < unlock) return fail(`Unlocks at level ${unlock}.`);
  if (save.eggs.length >= hatcherySlots(save.level)) return fail('The hatchery is full. Hatch an egg first.');
  if (save.shells < cost) return fail(`You need ${cost - save.shells} more shells.`);
  save.shells -= cost;
  save.eggs.push({ id: uid(rng), species: speciesId, laidAt: now, hatchAt: now + hatchMs });
  return finish(save, now, `${isMystery ? 'Mystery Egg' : def!.name + ' egg'} is incubating.`, []);
}

export function rollMystery(level: number, rng: Rng = defaultRng): string {
  const pool = SPECIES.filter((s) => s.unlockLevel <= level + 4).map((s) => ({ item: s.id, weight: RARITY_WEIGHT[s.rarity] }));
  return weightedPick(pool, rng);
}

export function hatchEgg(save: SaveData, eggId: string, now: number, rng: Rng = defaultRng): ActionResult {
  const egg = save.eggs.find((e) => e.id === eggId);
  if (!egg) return fail('That egg is gone.');
  if (egg.hatchAt > now) return fail('Not ready yet — good things take time.');
  const species = egg.species === MYSTERY_EGG.id ? rollMystery(save.level, rng) : egg.species;
  const def = SPECIES_BY_ID.get(species)!;
  const stats = tankStats(save, now);
  if (stats.load + def.bioload > stats.capacity)
    return fail(`Not enough room for a ${def.name} (${stats.load}/${stats.capacity}). Upgrade the tank or rehome a fish.`);
  save.eggs = save.eggs.filter((e) => e !== egg);
  const fish = newFish(species, now, rng);
  fish.hunger = 25;
  save.fish.push(fish);
  save.stats.hatched++;
  const events: SimEvent[] = [];
  pushEvent(save, events, { kind: 'info', at: now, tone: 'good', text: `${fish.name} the ${def.name} hatched!`, refId: fish.id });
  grantXp(save, def.xp, now, events);
  return finish(save, now, `Say hi to ${fish.name} the ${def.name}!`, events, { fish });
}

const clampPos = (v: number) => clamp(v, -0.46, 0.46);

export function buyPlant(save: SaveData, type: string, x: number, z: number, now: number, rng: Rng = defaultRng): ActionResult {
  const def = PLANTS_BY_ID.get(type);
  if (!def) return fail('Unknown plant.');
  if (save.level < def.unlockLevel) return fail(`Unlocks at level ${def.unlockLevel}.`);
  if (save.shells < def.cost) return fail(`You need ${def.cost - save.shells} more shells.`);
  if (save.plants.length >= 30) return fail('That is a lot of plants. Remove one first.');
  save.shells -= def.cost;
  save.plants.push({ id: uid(rng), type, plantedAt: now, x: clampPos(x), z: clampPos(z) });
  const events: SimEvent[] = [];
  grantXp(save, 3, now, events);
  return finish(save, now, `Planted ${def.name}.`, events);
}

export function buyDecor(save: SaveData, type: string, x: number, z: number, rot: number, now: number, rng: Rng = defaultRng): ActionResult {
  const def = DECOR_BY_ID.get(type);
  if (!def) return fail('Unknown decoration.');
  if (save.level < def.unlockLevel) return fail(`Unlocks at level ${def.unlockLevel}.`);
  if (save.shells < def.cost) return fail(`You need ${def.cost - save.shells} more shells.`);
  if (save.decor.length >= 20) return fail('Your tank is packed! Remove a decoration first.');
  save.shells -= def.cost;
  save.decor.push({
    id: uid(rng),
    type,
    x: clampPos(x),
    z: clampPos(z),
    rot,
    lootAt: def.lootEveryMs ? now + def.lootEveryMs : undefined,
  });
  const events: SimEvent[] = [];
  grantXp(save, 5, now, events);
  return finish(save, now, `Placed ${def.name}.`, events);
}

export function moveItem(save: SaveData, id: string, x: number, z: number, now: number): ActionResult {
  const item = save.plants.find((p) => p.id === id) ?? save.decor.find((d) => d.id === id);
  if (!item) return fail('Nothing to move.');
  item.x = clampPos(x);
  item.z = clampPos(z);
  return finish(save, now, 'Moved.', []);
}

export function removeItem(save: SaveData, id: string, now: number): ActionResult {
  const plant = save.plants.find((p) => p.id === id);
  const decor = save.decor.find((d) => d.id === id);
  const def = plant ? PLANTS_BY_ID.get(plant.type) : decor ? DECOR_BY_ID.get(decor.type) : undefined;
  if (!def) return fail('Nothing to remove.');
  const refund = Math.floor(def.cost * 0.4);
  save.plants = save.plants.filter((p) => p.id !== id);
  save.decor = save.decor.filter((d) => d.id !== id);
  delete save.flags[`chest:${id}`];
  save.shells += refund;
  return finish(save, now, `Removed ${def.name} (+${refund} shells).`, []);
}

export function rehomeFish(save: SaveData, fishId: string, now: number): ActionResult {
  const fish = save.fish.find((f) => f.id === fishId);
  if (!fish) return fail('That fish is not here.');
  const def = SPECIES_BY_ID.get(fish.species)!;
  const reward = Math.max(5, Math.round(def.cost * 0.3 * (0.4 + 0.6 * fishGrowth(fish, now))));
  save.fish = save.fish.filter((f) => f !== fish);
  save.shells += reward;
  save.stats.rehomed++;
  const events: SimEvent[] = [];
  pushEvent(save, events, { kind: 'info', at: now, tone: 'info', text: `${fish.name} moved to the Reef Sanctuary. (+${reward} shells)` });
  grantXp(save, 5, now, events);
  return finish(save, now, `${fish.name} is off to the Reef Sanctuary. Bon voyage!`, events, { shells: reward });
}

export function renameFish(save: SaveData, fishId: string, name: string, now: number): ActionResult {
  const fish = save.fish.find((f) => f.id === fishId);
  const clean = name.replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 18);
  if (!fish) return fail('That fish is not here.');
  if (!clean) return fail('Names need at least one letter.');
  fish.name = clean;
  return finish(save, now, `Renamed to ${clean}.`, []);
}

export function openChest(save: SaveData, decorId: string, now: number, rng: Rng = defaultRng): ActionResult {
  const chest = save.decor.find((d) => d.id === decorId);
  const def = chest && DECOR_BY_ID.get(chest.type);
  if (!chest || !def?.lootEveryMs || chest.lootAt === undefined) return fail('That is not a treasure chest.');
  if (chest.lootAt > now) return fail('The chest is still empty.');
  const events: SimEvent[] = [];
  let shells = Math.round(20 + rng() * 40 + save.level * 3);
  let msg = `The chest held ${shells} shells!`;
  if (rng() < 0.15 && save.level >= MYSTERY_EGG.unlockLevel - 2 && save.eggs.length < hatcherySlots(save.level)) {
    save.eggs.push({ id: uid(rng), species: MYSTERY_EGG.id, laidAt: now, hatchAt: now + MYSTERY_EGG.hatchMs });
    msg = `The chest held ${shells} shells and a Mystery Egg!`;
  }
  save.shells += shells;
  save.stats.shellsEarned += shells;
  save.stats.chestsOpened++;
  chest.lootAt = now + def.lootEveryMs;
  delete save.flags[`chest:${chest.id}`];
  grantXp(save, 10, now, events);
  return finish(save, now, msg, events, { shells });
}

export function upgradeTiers(kind: UpgradeKind): TierDef[] {
  return kind === 'filter' ? FILTER_TIERS : kind === 'tank' ? TANK_TIERS : FEEDER_TIERS;
}

export function buyUpgrade(save: SaveData, kind: UpgradeKind, now: number): ActionResult {
  const tiers = upgradeTiers(kind);
  const next = save.upgrades[kind] + 1;
  const tier = tiers[next];
  if (!tier) return fail('Already fully upgraded.');
  if (save.pending.some((p) => p.kind === kind)) return fail('Already being installed.');
  if (save.level < tier.unlockLevel) return fail(`Unlocks at level ${tier.unlockLevel}.`);
  if (save.shells < tier.cost) return fail(`You need ${tier.cost - save.shells} more shells.`);
  save.shells -= tier.cost;
  save.pending.push({ kind, tier: next, readyAt: now + tier.installMs });
  return finish(save, now, `${tier.name} ordered — installing now.`, []);
}

export function refillFeeder(save: SaveData, now: number): ActionResult {
  const cap = feederCapacity(save);
  if (!cap) return fail('Install an auto-feeder first.');
  const need = cap - save.feederPortions;
  if (need <= 0) return fail('The feeder is already full.');
  const cost = need * FEEDER_PORTION_COST;
  if (save.shells < cost) return fail(`Refilling costs ${cost} shells.`);
  save.shells -= cost;
  save.feederPortions = cap;
  return finish(save, now, `Feeder refilled (${cap} portions).`, []);
}

export function giveMedicine(save: SaveData, now: number): ActionResult {
  if (save.level < MEDICINE_UNLOCK) return fail(`Medicine unlocks at level ${MEDICINE_UNLOCK}.`);
  if (!save.fish.some((f) => f.health < 95)) return fail('Everyone is healthy.');
  if (save.shells < MEDICINE_COST) return fail(`Medicine costs ${MEDICINE_COST} shells.`);
  save.shells -= MEDICINE_COST;
  for (const f of save.fish) f.health = Math.min(100, f.health + 50);
  const events: SimEvent[] = [];
  grantXp(save, 5, now, events);
  return finish(save, now, 'Medicine administered. Everyone perks up.', events);
}

export function buyTheme(save: SaveData, id: string, now: number): ActionResult {
  const def = THEMES_BY_ID.get(id);
  if (!def) return fail('Unknown theme.');
  if (save.themesOwned.includes(id)) {
    save.theme = id;
    return finish(save, now, `${def.name} applied.`, []);
  }
  if (save.level < def.unlockLevel) return fail(`Unlocks at level ${def.unlockLevel}.`);
  if (save.shells < def.cost) return fail(`You need ${def.cost - save.shells} more shells.`);
  save.shells -= def.cost;
  save.themesOwned.push(id);
  save.theme = id;
  return finish(save, now, `${def.name} unlocked!`, []);
}

export function setLights(save: SaveData, mode: LightMode, now: number): ActionResult {
  save.lights = mode;
  return finish(save, now, `Lights: ${mode}.`, []);
}

export function renameTank(save: SaveData, name: string, now: number): ActionResult {
  const clean = name.trim().slice(0, 24);
  if (!clean) return fail('Give your tank a name.');
  save.name = clean;
  return finish(save, now, 'Tank renamed.', []);
}

/** Daily visit streak + bonus. Safe to call on every tick. */
export function checkDaily(save: SaveData, now: number): SimEvent[] {
  const today = dayKey(now);
  if (save.lastVisitDay === today) return [];
  const events: SimEvent[] = [];
  if (save.lastVisitDay) {
    const [y, m, d] = save.lastVisitDay.split('-').map(Number);
    const gap = daysBetween(new Date(y, m - 1, d).getTime(), now);
    save.streak = gap === 1 ? save.streak + 1 : 1;
    const bonus = 20 + 10 * Math.min(save.streak, 7);
    save.shells += bonus;
    pushEvent(save, events, {
      kind: 'daily',
      at: now,
      tone: 'good',
      text: save.streak > 1 ? `Day ${save.streak} visit streak! +${bonus} shells` : `Welcome back! Daily bonus +${bonus} shells`,
    });
  }
  save.lastVisitDay = today;
  checkAchievements(save, now, events);
  return events;
}

/** Short list of things needing attention, for the HUD. */
export function alerts(save: SaveData, now: number): { text: string; tone: 'warn' | 'bad' }[] {
  const out: { text: string; tone: 'warn' | 'bad' }[] = [];
  const starving = save.fish.filter((f) => f.hunger >= 100).length;
  const hungry = save.fish.filter((f) => f.hunger >= HUNGRY && f.hunger < 100).length;
  const weak = save.fish.filter((f) => f.health < 40).length;
  if (starving) out.push({ text: `${starving} starving`, tone: 'bad' });
  if (hungry) out.push({ text: `${hungry} hungry`, tone: 'warn' });
  if (weak) out.push({ text: `${weak} weak`, tone: 'bad' });
  if (save.water < 25) out.push({ text: 'Filthy water', tone: 'bad' });
  else if (save.water < 50) out.push({ text: 'Murky water', tone: 'warn' });
  const stats = tankStats(save, now);
  if (stats.load >= stats.capacity && save.eggs.some((e) => e.hatchAt <= now)) out.push({ text: 'Tank full', tone: 'warn' });
  return out;
}

export { fishLoad };

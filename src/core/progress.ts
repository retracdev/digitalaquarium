import { DECOR, PLANTS, SPECIES, THEMES, FILTER_TIERS, TANK_TIERS, FEEDER_TIERS, MYSTERY_EGG, MEDICINE_UNLOCK, SPECIES_BY_ID, hatcherySlots } from './catalog';
import type { SaveData, SimEvent } from './state';

export const MAX_LEVEL = 30;
const LOG_LIMIT = 60;

/** Total XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(40 * Math.pow(level - 1, 1.55));
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, needed: 0, pct: 1 };
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - base, needed: next - base, pct: (xp - base) / (next - base) };
}

export function pushEvent(save: SaveData, events: SimEvent[], ev: SimEvent): void {
  events.push(ev);
  save.log.push(ev);
  if (save.log.length > LOG_LIMIT) save.log.splice(0, save.log.length - LOG_LIMIT);
}

/** Things that become available exactly at `level`. */
export function unlocksAt(level: number): string[] {
  const out: string[] = [];
  for (const s of SPECIES) if (s.unlockLevel === level) out.push(s.name);
  for (const p of PLANTS) if (p.unlockLevel === level) out.push(p.name);
  for (const d of DECOR) if (d.unlockLevel === level) out.push(d.name);
  for (const t of THEMES) if (t.unlockLevel === level && t.cost > 0) out.push(`${t.name} theme`);
  for (const tier of [...FILTER_TIERS, ...TANK_TIERS, ...FEEDER_TIERS]) if (tier.unlockLevel === level && tier.cost > 0) out.push(tier.name);
  if (MYSTERY_EGG.unlockLevel === level) out.push(MYSTERY_EGG.name);
  if (MEDICINE_UNLOCK === level) out.push('Fish Medicine');
  if (level > 1 && hatcherySlots(level) > hatcherySlots(level - 1)) out.push('Extra hatchery slot');
  return out;
}

export function levelReward(level: number): number {
  return 25 + level * 10;
}

/** Adds XP and resolves any level-ups (with shell rewards). */
export function grantXp(save: SaveData, amount: number, now: number, events: SimEvent[]): void {
  if (amount <= 0) return;
  save.xp += Math.round(amount);
  const newLevel = levelFromXp(save.xp);
  while (save.level < newLevel) {
    save.level++;
    const reward = levelReward(save.level);
    save.shells += reward;
    const unlocks = unlocksAt(save.level);
    pushEvent(save, events, {
      kind: 'levelUp',
      at: now,
      tone: 'good',
      text: `Level ${save.level}! +${reward} shells${unlocks.length ? ` · Unlocked: ${unlocks.join(', ')}` : ''}`,
    });
  }
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
  check: (save: SaveData) => boolean;
}

const distinctSpecies = (s: SaveData) => new Set(s.fish.map((f) => f.species)).size;
const maxOfOneSpecies = (s: SaveData) => {
  const counts = new Map<string, number>();
  for (const f of s.fish) counts.set(f.species, (counts.get(f.species) ?? 0) + 1);
  return Math.max(0, ...counts.values());
};
const glowCount = (s: SaveData) =>
  s.fish.filter((f) => SPECIES_BY_ID.get(f.species)?.look.glow).length +
  s.plants.filter((p) => PLANTS.find((d) => d.id === p.type)?.glow).length +
  s.decor.filter((d) => DECOR.find((x) => x.id === d.type)?.glow).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_hatch', name: 'First Hatchling', desc: 'Hatch your first egg.', reward: 25, check: (s) => s.stats.hatched >= 1 },
  { id: 'school', name: "School's In", desc: 'Keep 6 fish of the same species.', reward: 50, check: (s) => maxOfOneSpecies(s) >= 6 },
  { id: 'full_house', name: 'Full House', desc: 'Keep 10 fish at once.', reward: 60, check: (s) => s.fish.length >= 10 },
  { id: 'variety', name: 'Biodiversity', desc: 'Keep 5 different species at once.', reward: 80, check: (s) => distinctSpecies(s) >= 5 },
  { id: 'green_thumb', name: 'Green Thumb', desc: 'Grow 6 plants to maturity.', reward: 50, check: (s) => s.plants.filter((p) => p.matured).length >= 6 },
  { id: 'decorator', name: 'Interior Designer', desc: 'Place 5 decorations.', reward: 50, check: (s) => s.decor.length >= 5 },
  { id: 'caretaker', name: 'Caretaker', desc: 'Feed your fish 50 times.', reward: 100, check: (s) => s.stats.fed >= 50 },
  { id: 'squeaky', name: 'Squeaky Clean', desc: 'Clean the tank 10 times.', reward: 60, check: (s) => s.stats.cleaned >= 10 },
  { id: 'treasure', name: 'Treasure Hunter', desc: 'Open 5 treasure chests.', reward: 80, check: (s) => s.stats.chestsOpened >= 5 },
  { id: 'night_light', name: 'Night Light', desc: 'Own 3 glowing things.', reward: 100, check: (s) => glowCount(s) >= 3 },
  { id: 'streak3', name: 'Regular', desc: 'Visit 3 days in a row.', reward: 50, check: (s) => s.streak >= 3 },
  { id: 'streak7', name: 'Devoted', desc: 'Visit 7 days in a row.', reward: 150, check: (s) => s.streak >= 7 },
  { id: 'level5', name: 'Rising Tide', desc: 'Reach level 5.', reward: 75, check: (s) => s.level >= 5 },
  { id: 'level10', name: 'Deep Diver', desc: 'Reach level 10.', reward: 150, check: (s) => s.level >= 10 },
  { id: 'level20', name: 'Ocean Keeper', desc: 'Reach level 20.', reward: 400, check: (s) => s.level >= 20 },
  { id: 'legend', name: 'Legendary', desc: 'Raise a legendary creature.', reward: 300, check: (s) => s.fish.some((f) => SPECIES_BY_ID.get(f.species)?.rarity === 'legendary') },
  { id: 'tycoon', name: 'Shell Tycoon', desc: 'Earn 5,000 shells in total.', reward: 200, check: (s) => s.stats.shellsEarned >= 5000 },
];

export function checkAchievements(save: SaveData, now: number, events: SimEvent[]): void {
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id) || !a.check(save)) continue;
    save.achievements.push(a.id);
    save.shells += a.reward;
    pushEvent(save, events, { kind: 'achievement', at: now, tone: 'good', text: `Milestone: ${a.name} · +${a.reward} shells` });
  }
}

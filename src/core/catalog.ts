import { HOUR, MINUTE } from './time';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Zone = 'top' | 'middle' | 'bottom' | 'any';
export type Behavior = 'school' | 'wander' | 'bottom' | 'glide' | 'hover' | 'jelly' | 'ray';
export type FishShape =
  | 'slim'
  | 'guppy'
  | 'round'
  | 'cory'
  | 'betta'
  | 'tall'
  | 'clown'
  | 'puffer'
  | 'seahorse'
  | 'jelly'
  | 'ray'
  | 'koi'
  | 'angler';
export type Pattern = 'none' | 'stripes' | 'spots' | 'bands' | 'stripe';

export interface FishLook {
  shape: FishShape;
  body: string;
  accent: string;
  fin?: string;
  pattern: Pattern;
  size: number;
  glow?: boolean;
}

export interface SpeciesDef {
  id: string;
  name: string;
  blurb: string;
  rarity: Rarity;
  unlockLevel: number;
  cost: number;
  hatchMs: number;
  growMs: number;
  bioload: number;
  /** hunger gained per hour (hunger 0 = full, 100 = starving) */
  hungerPerHour: number;
  /** shells generated per hour when adult and content */
  shellsPerHour: number;
  xp: number;
  zone: Zone;
  behavior: Behavior;
  look: FishLook;
}

export const SPECIES: SpeciesDef[] = [
  {
    id: 'neon_tetra',
    name: 'Neon Tetra',
    blurb: 'Tiny, social and shimmering. Happiest in a school of friends.',
    rarity: 'common',
    unlockLevel: 1,
    cost: 20,
    hatchMs: 1 * HOUR,
    growMs: 2 * HOUR,
    bioload: 1,
    hungerPerHour: 8,
    shellsPerHour: 2,
    xp: 10,
    zone: 'middle',
    behavior: 'school',
    look: { shape: 'slim', body: '#3b7cff', accent: '#ff3d63', pattern: 'stripe', size: 0.32 },
  },
  {
    id: 'guppy',
    name: 'Fancy Guppy',
    blurb: 'A flouncy little show-off with a tail like a sunset.',
    rarity: 'common',
    unlockLevel: 1,
    cost: 25,
    hatchMs: 1 * HOUR,
    growMs: 2 * HOUR,
    bioload: 1,
    hungerPerHour: 8,
    shellsPerHour: 2.5,
    xp: 10,
    zone: 'top',
    behavior: 'wander',
    look: { shape: 'guppy', body: '#cfd8e8', accent: '#ff8a3d', fin: '#a07bff', pattern: 'none', size: 0.34 },
  },
  {
    id: 'goldfish',
    name: 'Goldfish',
    blurb: 'A classic. Round, hungry and endlessly curious.',
    rarity: 'common',
    unlockLevel: 2,
    cost: 45,
    hatchMs: 1 * HOUR,
    growMs: 3 * HOUR,
    bioload: 3,
    hungerPerHour: 9,
    shellsPerHour: 4,
    xp: 15,
    zone: 'middle',
    behavior: 'wander',
    look: { shape: 'round', body: '#ff8a1f', accent: '#ffd27a', fin: '#ffb35c', pattern: 'none', size: 0.5 },
  },
  {
    id: 'cory',
    name: 'Cory Catfish',
    blurb: 'A whiskered bottom-sweeper that keeps the sand tidy.',
    rarity: 'common',
    unlockLevel: 3,
    cost: 50,
    hatchMs: 2 * HOUR,
    growMs: 3 * HOUR,
    bioload: 2,
    hungerPerHour: 6,
    shellsPerHour: 3.5,
    xp: 18,
    zone: 'bottom',
    behavior: 'bottom',
    look: { shape: 'cory', body: '#cbb89a', accent: '#5e4f40', pattern: 'spots', size: 0.4 },
  },
  {
    id: 'betta',
    name: 'Betta',
    blurb: 'Silk-finned and dramatic. Glides like it owns the place.',
    rarity: 'uncommon',
    unlockLevel: 4,
    cost: 90,
    hatchMs: 2 * HOUR,
    growMs: 4 * HOUR,
    bioload: 2,
    hungerPerHour: 7,
    shellsPerHour: 6,
    xp: 25,
    zone: 'top',
    behavior: 'glide',
    look: { shape: 'betta', body: '#d7263d', accent: '#4f3bff', fin: '#ff4f7b', pattern: 'none', size: 0.45 },
  },
  {
    id: 'angelfish',
    name: 'Angelfish',
    blurb: 'Tall, striped and elegant, with fins like sails.',
    rarity: 'uncommon',
    unlockLevel: 5,
    cost: 120,
    hatchMs: 2 * HOUR,
    growMs: 4 * HOUR,
    bioload: 3,
    hungerPerHour: 6,
    shellsPerHour: 7,
    xp: 30,
    zone: 'middle',
    behavior: 'glide',
    look: { shape: 'tall', body: '#ece6d6', accent: '#2c2a33', pattern: 'bands', size: 0.55 },
  },
  {
    id: 'clownfish',
    name: 'Clownfish',
    blurb: 'Bright, bold and fond of anemones.',
    rarity: 'uncommon',
    unlockLevel: 6,
    cost: 140,
    hatchMs: 3 * HOUR,
    growMs: 4 * HOUR,
    bioload: 2,
    hungerPerHour: 7,
    shellsPerHour: 8,
    xp: 35,
    zone: 'middle',
    behavior: 'wander',
    look: { shape: 'clown', body: '#ff6a13', accent: '#ffffff', fin: '#1d1a22', pattern: 'bands', size: 0.42 },
  },
  {
    id: 'pufferfish',
    name: 'Pufferfish',
    blurb: 'Poke it and find out. (It puffs. It is fine.)',
    rarity: 'rare',
    unlockLevel: 8,
    cost: 220,
    hatchMs: 3 * HOUR,
    growMs: 6 * HOUR,
    bioload: 3,
    hungerPerHour: 6,
    shellsPerHour: 11,
    xp: 50,
    zone: 'middle',
    behavior: 'wander',
    look: { shape: 'puffer', body: '#dcc37c', accent: '#6b5532', pattern: 'spots', size: 0.5 },
  },
  {
    id: 'seahorse',
    name: 'Seahorse',
    blurb: 'Bobs upright and loves to loiter near plants.',
    rarity: 'rare',
    unlockLevel: 10,
    cost: 300,
    hatchMs: 4 * HOUR,
    growMs: 6 * HOUR,
    bioload: 2,
    hungerPerHour: 5,
    shellsPerHour: 13,
    xp: 60,
    zone: 'middle',
    behavior: 'hover',
    look: { shape: 'seahorse', body: '#ffc24d', accent: '#ff8f3d', pattern: 'none', size: 0.55 },
  },
  {
    id: 'moon_jelly',
    name: 'Moon Jelly',
    blurb: 'Drifts and pulses. Glows softly when the lights go down.',
    rarity: 'rare',
    unlockLevel: 12,
    cost: 380,
    hatchMs: 4 * HOUR,
    growMs: 6 * HOUR,
    bioload: 2,
    hungerPerHour: 3.5,
    shellsPerHour: 15,
    xp: 75,
    zone: 'any',
    behavior: 'jelly',
    look: { shape: 'jelly', body: '#cfe3ff', accent: '#ff9be6', pattern: 'none', size: 0.55, glow: true },
  },
  {
    id: 'lanternfish',
    name: 'Lanternfish',
    blurb: 'Deep-sea commuters dotted with tiny lights.',
    rarity: 'rare',
    unlockLevel: 14,
    cost: 450,
    hatchMs: 6 * HOUR,
    growMs: 8 * HOUR,
    bioload: 1,
    hungerPerHour: 6,
    shellsPerHour: 16,
    xp: 90,
    zone: 'middle',
    behavior: 'school',
    look: { shape: 'slim', body: '#2c3754', accent: '#7ff6ff', pattern: 'spots', size: 0.36, glow: true },
  },
  {
    id: 'stingray',
    name: 'Spotted Ray',
    blurb: 'Glides over the sand like a slow, polka-dotted kite.',
    rarity: 'rare',
    unlockLevel: 16,
    cost: 650,
    hatchMs: 6 * HOUR,
    growMs: 8 * HOUR,
    bioload: 5,
    hungerPerHour: 5,
    shellsPerHour: 24,
    xp: 120,
    zone: 'bottom',
    behavior: 'ray',
    look: { shape: 'ray', body: '#36456a', accent: '#e8f1ff', pattern: 'spots', size: 0.9 },
  },
  {
    id: 'starlight_koi',
    name: 'Starlight Koi',
    blurb: 'Legend says it swam down from the night sky. It sparkles.',
    rarity: 'legendary',
    unlockLevel: 20,
    cost: 1200,
    hatchMs: 8 * HOUR,
    growMs: 12 * HOUR,
    bioload: 6,
    hungerPerHour: 5,
    shellsPerHour: 40,
    xp: 250,
    zone: 'middle',
    behavior: 'glide',
    look: { shape: 'koi', body: '#f4f1ff', accent: '#ff4f6d', fin: '#b9b2ff', pattern: 'spots', size: 0.85, glow: true },
  },
  {
    id: 'void_angler',
    name: 'Void Angler',
    blurb: 'Grumpy face, glorious lantern. A lurker from the deep dark.',
    rarity: 'legendary',
    unlockLevel: 24,
    cost: 1800,
    hatchMs: 12 * HOUR,
    growMs: 12 * HOUR,
    bioload: 6,
    hungerPerHour: 4,
    shellsPerHour: 55,
    xp: 350,
    zone: 'bottom',
    behavior: 'wander',
    look: { shape: 'angler', body: '#2a2238', accent: '#9effa0', pattern: 'none', size: 0.8, glow: true },
  },
];

export const MYSTERY_EGG = {
  id: 'mystery',
  name: 'Mystery Egg',
  blurb: 'Could be anything — even something you have not unlocked yet.',
  unlockLevel: 7,
  cost: 160,
  hatchMs: 4 * HOUR,
};

export const STARTER_EGG_MS = 3 * MINUTE;

export interface PlantDef {
  id: string;
  name: string;
  blurb: string;
  unlockLevel: number;
  cost: number;
  growMs: number;
  xp: number;
  /** water cleanliness restored per hour when mature */
  cleanPerHour: number;
  shellsPerHour: number;
  happiness: number;
  glow?: boolean;
}

export const PLANTS: PlantDef[] = [
  { id: 'java_fern', name: 'Java Fern', blurb: 'Hardy leafy clumps. Impossible to kill.', unlockLevel: 1, cost: 15, growMs: 1 * HOUR, xp: 8, cleanPerHour: 0.4, shellsPerHour: 0.5, happiness: 3 },
  { id: 'eelgrass', name: 'Eelgrass', blurb: 'Long ribbons that sway in the current.', unlockLevel: 1, cost: 20, growMs: 1 * HOUR, xp: 8, cleanPerHour: 0.5, shellsPerHour: 0.5, happiness: 3 },
  { id: 'moss_ball', name: 'Moss Ball', blurb: 'A fuzzy green friend. Excellent water scrubber.', unlockLevel: 2, cost: 25, growMs: 2 * HOUR, xp: 12, cleanPerHour: 0.9, shellsPerHour: 0.6, happiness: 3 },
  { id: 'red_ludwigia', name: 'Red Ludwigia', blurb: 'Stems of ruby leaves that blush under the light.', unlockLevel: 4, cost: 45, growMs: 2 * HOUR, xp: 18, cleanPerHour: 0.6, shellsPerHour: 1.2, happiness: 4 },
  { id: 'kelp', name: 'Giant Kelp', blurb: 'A towering forest in a single plant.', unlockLevel: 7, cost: 80, growMs: 3 * HOUR, xp: 30, cleanPerHour: 0.8, shellsPerHour: 2, happiness: 5 },
  { id: 'glow_coral', name: 'Glow Coral', blurb: 'Branching coral that lights up at night.', unlockLevel: 9, cost: 140, growMs: 4 * HOUR, xp: 45, cleanPerHour: 0.5, shellsPerHour: 3, happiness: 6, glow: true },
  { id: 'anemone', name: 'Anemone', blurb: 'Wiggly, cosy and a clownfish favourite.', unlockLevel: 11, cost: 200, growMs: 4 * HOUR, xp: 60, cleanPerHour: 0.4, shellsPerHour: 4, happiness: 6 },
  { id: 'starbloom', name: 'Starbloom', blurb: 'A rare flower that blooms into tiny stars.', unlockLevel: 17, cost: 400, growMs: 6 * HOUR, xp: 90, cleanPerHour: 1, shellsPerHour: 7, happiness: 8, glow: true },
];

export interface DecorDef {
  id: string;
  name: string;
  blurb: string;
  unlockLevel: number;
  cost: number;
  happiness: number;
  /** multiplies water decay (airstones etc.) */
  oxygen?: number;
  /** treasure chests refill on this interval */
  lootEveryMs?: number;
  glow?: boolean;
  bubbles?: boolean;
}

export const DECOR: DecorDef[] = [
  { id: 'rocks', name: 'River Rocks', blurb: 'Smooth stones for hiding and lounging.', unlockLevel: 1, cost: 20, happiness: 2 },
  { id: 'driftwood', name: 'Driftwood', blurb: 'Gnarled wood with nooks to explore.', unlockLevel: 2, cost: 35, happiness: 3 },
  { id: 'airstone', name: 'Air Stone', blurb: 'A bubble curtain. Oxygenates water so it stays clean longer.', unlockLevel: 3, cost: 60, happiness: 3, oxygen: 0.85, bubbles: true },
  { id: 'treasure_chest', name: 'Treasure Chest', blurb: 'Fills with loot every 4 hours. Tap it when it glows.', unlockLevel: 5, cost: 150, happiness: 4, lootEveryMs: 4 * HOUR },
  { id: 'castle', name: 'Tiny Castle', blurb: 'Every fish deserves a castle.', unlockLevel: 6, cost: 180, happiness: 6 },
  { id: 'arch', name: 'Stone Arch', blurb: 'A natural arch to swim through.', unlockLevel: 8, cost: 220, happiness: 6 },
  { id: 'amphora', name: 'Sunken Amphora', blurb: 'An ancient jar, tipped over and lived-in.', unlockLevel: 9, cost: 160, happiness: 5 },
  { id: 'geode', name: 'Crystal Geode', blurb: 'Amethyst spires that hum with light.', unlockLevel: 13, cost: 350, happiness: 7, glow: true },
  { id: 'volcano', name: 'Bubble Volcano', blurb: 'Erupts with bubbles and a warm glow.', unlockLevel: 15, cost: 500, happiness: 8, oxygen: 0.8, bubbles: true, glow: true },
  { id: 'satellite', name: 'Fallen Satellite', blurb: 'It came from space. The fish have opinions.', unlockLevel: 18, cost: 700, happiness: 10, glow: true },
];

export interface TierDef {
  name: string;
  cost: number;
  installMs: number;
  unlockLevel: number;
}

export interface FilterTier extends TierDef {
  decayMult: number;
}
export interface TankTier extends TierDef {
  capacity: number;
  widthScale: number;
}
export interface FeederTier extends TierDef {
  portions: number;
}

export const FILTER_TIERS: FilterTier[] = [
  { name: 'Sponge Filter', cost: 0, installMs: 0, unlockLevel: 1, decayMult: 1 },
  { name: 'Canister Filter', cost: 300, installMs: 1 * HOUR, unlockLevel: 3, decayMult: 0.75 },
  { name: 'Bio Filter', cost: 900, installMs: 3 * HOUR, unlockLevel: 8, decayMult: 0.55 },
  { name: 'Reef Purifier', cost: 2200, installMs: 6 * HOUR, unlockLevel: 14, decayMult: 0.4 },
];

export const TANK_TIERS: TankTier[] = [
  { name: 'Nano Tank', cost: 0, installMs: 0, unlockLevel: 1, capacity: 12, widthScale: 1 },
  { name: 'Standard Tank', cost: 400, installMs: 2 * HOUR, unlockLevel: 4, capacity: 20, widthScale: 1.2 },
  { name: 'Grand Tank', cost: 1200, installMs: 4 * HOUR, unlockLevel: 9, capacity: 32, widthScale: 1.45 },
  { name: 'Panorama Tank', cost: 3000, installMs: 8 * HOUR, unlockLevel: 15, capacity: 48, widthScale: 1.75 },
];

export const FEEDER_TIERS: FeederTier[] = [
  { name: 'No Auto-Feeder', cost: 0, installMs: 0, unlockLevel: 1, portions: 0 },
  { name: 'Auto-Feeder', cost: 350, installMs: 1 * HOUR, unlockLevel: 6, portions: 3 },
  { name: 'Smart Feeder', cost: 900, installMs: 2 * HOUR, unlockLevel: 12, portions: 6 },
];

export const FEEDER_PORTION_COST = 10;
export const MEDICINE_COST = 40;
export const MEDICINE_UNLOCK = 3;

export interface ThemeDef {
  id: string;
  name: string;
  blurb: string;
  unlockLevel: number;
  cost: number;
  top: string;
  bottom: string;
  water: string;
  sand: string;
  stars?: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: 'lagoon', name: 'Shallow Lagoon', blurb: 'Sunlit blue and warm sand.', unlockLevel: 1, cost: 0, top: '#4fb6d8', bottom: '#0b3a5c', water: '#3fa7c9', sand: '#e2cf9f' },
  { id: 'twilight', name: 'Twilight Reef', blurb: 'Dusky purples over a pink reef.', unlockLevel: 6, cost: 250, top: '#8a6fd1', bottom: '#1d1640', water: '#6c5bc4', sand: '#d8b8c8' },
  { id: 'abyss', name: 'The Abyss', blurb: 'Deep, dark and perfect for glowing things.', unlockLevel: 12, cost: 600, top: '#14365a', bottom: '#02060e', water: '#0f3050', sand: '#5d6070' },
  { id: 'nebula', name: 'retrac Nebula', blurb: 'An aquarium adrift in space. Stars included.', unlockLevel: 18, cost: 1200, top: '#6a5fa8', bottom: '#0b0a14', water: '#4a4380', sand: '#8c87a6', stars: true },
];

export const HATCHERY_BASE_SLOTS = 2;
export function hatcherySlots(level: number): number {
  return Math.min(5, HATCHERY_BASE_SLOTS + (level >= 5 ? 1 : 0) + (level >= 10 ? 1 : 0) + (level >= 15 ? 1 : 0));
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
export const SPECIES_BY_ID = byId(SPECIES);
export const PLANTS_BY_ID = byId(PLANTS);
export const DECOR_BY_ID = byId(DECOR);
export const THEMES_BY_ID = byId(THEMES);

export function speciesDef(id: string): SpeciesDef {
  const def = SPECIES_BY_ID.get(id);
  if (!def) throw new Error(`Unknown species: ${id}`);
  return def;
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, uncommon: 6, rare: 3, legendary: 1 };

import { describe, expect, it } from 'vitest';
import * as A from '../src/core/actions';
import { simulate, STARVE_DAMAGE, tankStats } from '../src/core/sim';
import { createNewSave, newFish, STARTER_HUNGER, TUTORIAL_DONE } from '../src/core/state';
import { seeded } from '../src/core/rng';
import { HOUR, MINUTE } from '../src/core/time';

const T0 = new Date(2026, 0, 10, 9, 0, 0).getTime();

function fresh() {
  return createNewSave('Test Tank', T0, seeded(1));
}

describe('simulation', () => {
  it('makes fish hungrier over time', () => {
    const s = fresh();
    const before = s.fish[0].hunger;
    simulate(s, T0 + 2 * HOUR);
    expect(s.fish[0].hunger).toBeCloseTo(before + 16, 5);
    expect(s.lastTick).toBe(T0 + 2 * HOUR);
  });

  it('starving fish lose health and eventually die', () => {
    const s = fresh();
    // Starter fish begin at 45 hunger + 8/h → starving at ~7h, then 100/6 ≈ 16.7h to die. Alive at 18h, dead by 26h.
    expect(s.fish.every((f) => f.hunger === STARTER_HUNGER)).toBe(true);
    const ev1 = simulate(s, T0 + 18 * HOUR);
    expect(s.fish.length).toBe(3);
    expect(ev1.some((e) => e.kind === 'hungry')).toBe(true);
    expect(ev1.some((e) => e.kind === 'starving')).toBe(true);
    const ev2 = simulate(s, T0 + 26 * HOUR);
    expect(s.fish.length).toBe(0);
    expect(s.memorial).toHaveLength(3);
    expect(s.memorial[0].cause).toBe('starvation');
    expect(s.stats.fishLost).toBe(3);
    expect(ev2.filter((e) => e.kind === 'fishDied')).toHaveLength(3);
    expect(STARVE_DAMAGE).toBeGreaterThan(0);
  });

  it('feeding regularly keeps fish alive for days', () => {
    const s = fresh();
    for (let h = 8; h <= 96; h += 8) {
      simulate(s, T0 + h * HOUR);
      A.feed(s, T0 + h * HOUR);
      if (h % 24 === 0) A.clean(s, T0 + h * HOUR);
    }
    expect(s.fish.length).toBe(3);
    expect(s.fish.every((f) => f.health > 90)).toBe(true);
  });

  it('dirty water makes fish sick even when fed', () => {
    const s = fresh();
    s.water = 0;
    s.plants = [];
    for (let h = 4; h <= 48; h += 4) {
      simulate(s, T0 + h * HOUR);
      s.water = 0;
      for (const f of s.fish) f.hunger = 10;
    }
    expect(s.fish.length).toBe(0);
    expect(s.memorial[0].cause).toBe('water');
  });

  it('water decays and plants slow it down', () => {
    const a = fresh();
    const b = fresh();
    b.plants = [];
    simulate(a, T0 + 10 * HOUR);
    simulate(b, T0 + 10 * HOUR);
    expect(a.water).toBeLessThan(92);
    expect(a.water).toBeGreaterThan(b.water);
  });

  it('better filters slow water decay', () => {
    const s = fresh();
    const base = tankStats(s, T0).decayPerHour;
    s.upgrades.filter = 3;
    expect(tankStats(s, T0).decayPerHour).toBeLessThan(base * 0.5);
  });

  it('grown, happy fish make shells up to a cap', () => {
    const s = fresh();
    simulate(s, T0 + 3 * HOUR);
    expect(s.pendingShells).toBeGreaterThan(5);
    s.pendingShells = 0;
    for (const f of s.fish) f.hunger = 0;
    simulate(s, T0 + 7 * HOUR);
    const r = A.collectShells(s, T0 + 7 * HOUR);
    expect(r.ok).toBe(true);
    expect(s.shells).toBeGreaterThan(120);
    s.pendingShells = 1e9;
    simulate(s, T0 + 8 * HOUR);
    expect(s.pendingShells).toBeLessThanOrEqual(150 + 40 * s.level);
  });

  it('starter egg becomes ready after 3 minutes and hatches', () => {
    const s = fresh();
    expect(A.hatchEgg(s, s.eggs[0].id, T0 + MINUTE).ok).toBe(false);
    const ev = simulate(s, T0 + 3 * MINUTE);
    expect(ev.some((e) => e.kind === 'eggReady')).toBe(true);
    const r = A.hatchEgg(s, s.eggs[0].id, T0 + 3 * MINUTE, seeded(3));
    expect(r.ok).toBe(true);
    expect(s.fish).toHaveLength(4);
    expect(s.fish[3].species).toBe('guppy');
    expect(s.achievements).toContain('first_hatch');
    expect(s.xp).toBeGreaterThan(0);
  });

  it('upgrades take real time to install', () => {
    const s = fresh();
    s.level = 5;
    s.shells = 1000;
    expect(A.buyUpgrade(s, 'filter', T0).ok).toBe(true);
    expect(A.buyUpgrade(s, 'filter', T0).ok).toBe(false);
    simulate(s, T0 + 30 * MINUTE);
    expect(s.upgrades.filter).toBe(0);
    const ev = simulate(s, T0 + 61 * MINUTE);
    expect(s.upgrades.filter).toBe(1);
    expect(ev.some((e) => e.kind === 'upgradeDone')).toBe(true);
  });

  it('auto-feeder feeds hungry fish until it runs out', () => {
    const s = fresh();
    s.upgrades.feeder = 1;
    s.feederPortions = 2;
    const ev = simulate(s, T0 + 40 * HOUR);
    expect(ev.filter((e) => e.kind === 'autoFeed')).toHaveLength(2);
    expect(ev.some((e) => e.kind === 'feederEmpty')).toBe(true);
    expect(s.feederPortions).toBe(0);
  });

  it('does not announce "all grown up" for fish that started grown', () => {
    const s = fresh();
    const ev = simulate(s, T0 + 30 * MINUTE);
    expect(ev.some((e) => e.kind === 'fishGrown')).toBe(false);
  });

  it('announces when a hatchling grows up', () => {
    const s = fresh();
    s.fish = [newFish('neon_tetra', T0, seeded(5))];
    for (const f of s.fish) f.hunger = 0;
    const ev = simulate(s, T0 + 2 * HOUR + MINUTE);
    expect(ev.filter((e) => e.kind === 'fishGrown')).toHaveLength(1);
  });

  it('catches up a week offline quickly', () => {
    const s = fresh();
    const start = performance.now();
    simulate(s, T0 + 7 * 24 * HOUR);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('actions', () => {
  it('feeding when not hungry overfeeds and dirties water', () => {
    const s = fresh();
    for (const f of s.fish) f.hunger = 0;
    const water = s.water;
    const r = A.feed(s, T0);
    expect(r.ok).toBe(true);
    expect(s.water).toBeLessThan(water);
    expect(s.xp).toBe(0);
  });

  it('feeding hungry fish gives XP', () => {
    const s = fresh();
    for (const f of s.fish) f.hunger = 80;
    A.feed(s, T0);
    expect(s.fish[0].hunger).toBe(25);
    expect(s.xp).toBeGreaterThan(0);
  });

  it('respects level locks, costs and hatchery slots', () => {
    const s = fresh();
    expect(A.buyEgg(s, 'betta', T0).ok).toBe(false);
    expect(A.buyEgg(s, 'neon_tetra', T0).ok).toBe(true); // slot 2 of 2
    expect(A.buyEgg(s, 'neon_tetra', T0).msg).toMatch(/hatchery is full/);
    s.shells = 0;
    expect(A.buyPlant(s, 'java_fern', 0, 0, T0).ok).toBe(false);
  });

  it('blocks hatching when the tank is at capacity', () => {
    const s = fresh();
    while (s.fish.length < 12) s.fish.push(newFish('neon_tetra', T0, seeded(s.fish.length)));
    s.eggs[0].hatchAt = T0;
    const r = A.hatchEgg(s, s.eggs[0].id, T0);
    expect(r.ok).toBe(false);
    expect(r.msg).toMatch(/room/);
  });

  it('treasure chests refill every 4 hours', () => {
    const s = fresh();
    s.level = 5;
    s.shells = 500;
    A.buyDecor(s, 'treasure_chest', 0, 0, 0, T0);
    const chest = s.decor.find((d) => d.type === 'treasure_chest')!;
    expect(A.openChest(s, chest.id, T0 + HOUR).ok).toBe(false);
    const ev = simulate(s, T0 + 4 * HOUR);
    expect(ev.some((e) => e.kind === 'chestReady')).toBe(true);
    const r = A.openChest(s, chest.id, T0 + 4 * HOUR, seeded(9));
    expect(r.ok).toBe(true);
    expect(chest.lootAt).toBe(T0 + 8 * HOUR);
  });

  it('daily streaks grow on consecutive days and reset after a gap', () => {
    const s = fresh();
    A.checkDaily(s, T0);
    expect(s.streak).toBe(1);
    A.checkDaily(s, T0 + 24 * HOUR);
    expect(s.streak).toBe(2);
    expect(A.checkDaily(s, T0 + 25 * HOUR)).toHaveLength(0);
    A.checkDaily(s, T0 + 4 * 24 * HOUR);
    expect(s.streak).toBe(1);
  });

  it('rehoming frees space and pays a little', () => {
    const s = fresh();
    const shells = s.shells;
    expect(A.rehomeFish(s, s.fish[0].id, T0).ok).toBe(true);
    expect(s.fish).toHaveLength(2);
    expect(s.shells).toBeGreaterThan(shells);
  });

  it('the very first feed of a new tank is not an overfeed', () => {
    const s = fresh();
    const water = s.water;
    A.feed(s, T0);
    expect(s.water).toBe(water);
    expect(s.xp).toBeGreaterThan(0);
  });

  it('tutorial: new tanks start it, skipping pays nothing, finishing pays once', () => {
    const s = fresh();
    expect(s.tutorial).toBe(0);
    expect(A.setTutorialStep(s, 4, T0).ok).toBe(true);
    expect(s.tutorial).toBe(4);
    const skipped = fresh();
    const before = skipped.shells;
    expect(A.endTutorial(skipped, false, T0).ok).toBe(true);
    expect(skipped.tutorial).toBe(TUTORIAL_DONE);
    expect(skipped.shells).toBe(before);
    expect(A.setTutorialStep(skipped, 2, T0).ok).toBe(false); // stays finished
    const done = fresh();
    A.endTutorial(done, true, T0);
    expect(done.shells).toBe(before + A.TUTORIAL_REWARD);
    expect(A.endTutorial(done, true, T0).ok).toBe(false);
    expect(done.shells).toBe(before + A.TUTORIAL_REWARD);
    A.restartTutorial(done, T0);
    expect(done.tutorial).toBe(0);
  });

  it('renames fish safely', () => {
    const s = fresh();
    A.renameFish(s, s.fish[0].id, '  <b>Sir Fins</b>  ', T0);
    expect(s.fish[0].name).toBe('bSir Finsb');
  });
});

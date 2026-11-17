import { describe, expect, it } from 'vitest';
import { levelFromXp, levelProgress, xpForLevel, grantXp, MAX_LEVEL } from '../src/core/progress';
import { formatDuration, parseDuration, HOUR, MINUTE, DAY } from '../src/core/time';
import { createNewSave, migrate } from '../src/core/state';
import { runCommand, type ConsoleHost } from '../src/core/devconsole';
import { simulate } from '../src/core/sim';
import { SPECIES, PLANTS, DECOR } from '../src/core/catalog';

const T0 = new Date(2026, 0, 10, 9, 0, 0).getTime();

describe('time helpers', () => {
  it('parses durations', () => {
    expect(parseDuration('90s')).toBe(90_000);
    expect(parseDuration('30m')).toBe(30 * MINUTE);
    expect(parseDuration('2h')).toBe(2 * HOUR);
    expect(parseDuration('1h30m')).toBe(90 * MINUTE);
    expect(parseDuration('1d')).toBe(DAY);
    expect(parseDuration('1.5h')).toBe(90 * MINUTE);
    expect(parseDuration('15')).toBe(15 * MINUTE);
    expect(parseDuration('soon')).toBeNull();
    expect(parseDuration('2hx')).toBeNull();
  });
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('now');
    expect(formatDuration(5_000)).toBe('5s');
    expect(formatDuration(65_000)).toBe('1m 05s');
    expect(formatDuration(HOUR + 5 * MINUTE)).toBe('1h 05m');
    expect(formatDuration(2 * DAY + 3 * HOUR)).toBe('2d 3h');
  });
});

describe('leveling', () => {
  it('has a strictly increasing curve', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
  });
  it('round-trips xp to level', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) expect(levelFromXp(xpForLevel(l))).toBe(l);
    expect(levelProgress(xpForLevel(3) + 1).level).toBe(3);
  });
  it('awards shells on level up', () => {
    const s = createNewSave('x', T0);
    const events: never[] = [];
    grantXp(s, xpForLevel(4), T0, events);
    expect(s.level).toBe(4);
    expect(s.shells).toBeGreaterThan(120);
    expect(events.length).toBe(3);
  });
});

describe('catalog', () => {
  it('has unique ids and sane numbers', () => {
    for (const list of [SPECIES, PLANTS, DECOR]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of list) expect(item.cost).toBeGreaterThan(0);
    }
    for (const s of SPECIES) expect(s.hatchMs).toBeGreaterThanOrEqual(HOUR);
  });
});

describe('migrate', () => {
  it('rejects junk', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('hello')).toBeNull();
    expect(migrate({ foo: 1 })).toBeNull();
  });
  it('fills in missing fields', () => {
    const s = migrate({ v: 1, createdAt: T0, name: 'Old', shells: 5 })!;
    expect(s.name).toBe('Old');
    expect(s.shells).toBe(5);
    expect(s.fish).toEqual([]);
    expect(s.upgrades).toEqual({ filter: 0, tank: 0, feeder: 0 });
    expect(s.lights).toBe('auto');
    // tanks saved before the tutorial existed don't get one sprung on them
    expect(s.tutorial).toBe(-1);
  });
  it('drops unknown species', () => {
    const base = createNewSave('x', T0);
    base.fish.push({ ...base.fish[0], id: 'zzz', species: 'kraken' });
    expect(migrate(JSON.parse(JSON.stringify(base)))!.fish).toHaveLength(3);
  });
});

describe('secret console', () => {
  function host() {
    const save = createNewSave('x', T0);
    const h: ConsoleHost = {
      save,
      now: () => T0 + save.timeOffset,
      resync: () => simulate(save, T0 + save.timeOffset),
    };
    return h;
  }

  it('skip finishes eggs, plants and upgrades', () => {
    const h = host();
    h.save.level = 5;
    h.save.shells = 1000;
    h.save.pending.push({ kind: 'filter', tier: 1, readyAt: T0 + HOUR });
    h.save.plants.push({ id: 'p1', type: 'kelp', plantedAt: T0, x: 0, z: 0 });
    const r = runCommand(h, 'skip');
    expect(r.changed).toBe(true);
    expect(h.save.eggs[0].hatchAt).toBeLessThanOrEqual(T0);
    expect(h.save.upgrades.filter).toBe(1);
    expect(h.save.plants.find((p) => p.id === 'p1')!.matured).toBe(true);
  });

  it('warp advances the clock and the simulation', () => {
    const h = host();
    runCommand(h, 'warp 5h');
    expect(h.save.timeOffset).toBe(5 * HOUR);
    expect(h.save.lastTick).toBe(T0 + 5 * HOUR);
    expect(h.save.fish[0].hunger).toBeGreaterThan(50);
  });

  it('handles shells, level, spawn and bad input', () => {
    const h = host();
    runCommand(h, 'shells 500');
    expect(h.save.shells).toBe(620);
    runCommand(h, 'level 10');
    expect(h.save.level).toBe(10);
    runCommand(h, 'spawn goldfish 2');
    expect(h.save.fish.filter((f) => f.species === 'goldfish')).toHaveLength(2);
    expect(runCommand(h, 'spawn kraken').lines[0]).toMatch(/Unknown species/);
    expect(runCommand(h, 'nope').lines[0]).toMatch(/Unknown command/);
    expect(runCommand(h, 'help').lines.length).toBeGreaterThan(5);
  });
});

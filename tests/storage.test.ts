import { beforeEach, describe, expect, it } from 'vitest';
import { CookieSaveBackend, encodeSave } from '../src/storage/saves';
import { ChunkedCookieStore, CHUNK_SIZE } from '../src/storage/cookies';
import { createNewSave, newFish, SLOT_COUNT } from '../src/core/state';
import { AquariumController } from '../src/app/controller';
import { HOUR } from '../src/core/time';

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

beforeEach(clearCookies);

describe('chunked cookies', () => {
  it('round-trips small and large values', () => {
    const store = new ChunkedCookieStore();
    store.set('a', 'hello');
    expect(store.get('a')).toBe('hello');
    const big = 'x'.repeat(CHUNK_SIZE * 2 + 17);
    store.set('b', big);
    expect(store.get('b')).toBe(big);
    store.set('b', 'short');
    expect(store.get('b')).toBe('short');
    expect(document.cookie).not.toContain('daq_b.1=');
    store.remove('b');
    expect(store.get('b')).toBeNull();
  });

  it('treats a missing chunk as corrupt', () => {
    const store = new ChunkedCookieStore();
    store.set('c', 'y'.repeat(CHUNK_SIZE + 5));
    document.cookie = 'daq_c.1=; Max-Age=0; Path=/';
    expect(store.get('c')).toBeNull();
  });
});

describe('save slots', () => {
  it('lists five empty slots initially', () => {
    const b = new CookieSaveBackend();
    const list = b.list();
    expect(list).toHaveLength(SLOT_COUNT);
    expect(list.every((s) => 'empty' in s)).toBe(true);
  });

  it('saves, loads and deletes independent slots', () => {
    const b = new CookieSaveBackend();
    const one = createNewSave('Reef One', Date.now());
    const three = createNewSave('Abyss Three', Date.now());
    three.shells = 999;
    b.save(1, one);
    b.save(3, three);
    expect(b.load(1)!.name).toBe('Reef One');
    expect(b.load(3)!.shells).toBe(999);
    expect(b.load(2)).toBeNull();
    const list = b.list();
    expect('name' in list[0] && list[0].name).toBe('Reef One');
    expect('empty' in list[1]).toBe(true);
    b.remove(1);
    expect(b.load(1)).toBeNull();
    expect(b.load(3)!.name).toBe('Abyss Three');
  });

  it('survives a large, busy tank spread over several cookies', () => {
    const b = new CookieSaveBackend();
    const s = createNewSave('Packed', Date.now());
    for (let i = 0; i < 48; i++) s.fish.push(newFish('neon_tetra', Date.now()));
    for (let i = 0; i < 40; i++) s.memorial.push({ name: `Fish${i}`, species: 'guppy', bornAt: i, diedAt: i + 1, cause: 'water' });
    for (let i = 0; i < 60; i++) s.log.push({ kind: 'info', text: `Event number ${i} with some text`, at: Date.now() + i, tone: 'info' });
    b.save(5, s);
    const loaded = b.load(5)!;
    expect(loaded.fish).toHaveLength(51);
    expect(loaded.log).toHaveLength(60);
    expect(encodeSave(s).length).toBeLessThan(CHUNK_SIZE * 8);
  });

  it('remembers the active slot and rejects bad slot numbers', () => {
    const b = new CookieSaveBackend();
    expect(b.getActiveSlot()).toBeNull();
    b.setActiveSlot(4);
    expect(b.getActiveSlot()).toBe(4);
    expect(() => b.save(6, createNewSave('x', 0))).toThrow();
    expect(() => b.load(0)).toThrow();
  });
});

describe('controller', () => {
  it('creates, switches between and resumes slots', () => {
    const c = new AquariumController(new CookieSaveBackend());
    c.createSlot(1, 'First');
    c.save.shells = 777;
    c.createSlot(2, 'Second');
    expect(c.slot).toBe(2);
    expect(c.save.name).toBe('Second');
    c.open(1);
    expect(c.save.name).toBe('First');
    expect(c.save.shells).toBe(777);
    c.close();
  });

  it('catches up time spent away when a slot is reopened', () => {
    const backend = new CookieSaveBackend();
    const s = createNewSave('Away', Date.now() - 40 * HOUR);
    backend.save(1, s);
    const c = new AquariumController(backend);
    const seen: string[] = [];
    c.on((e) => {
      if (e.type === 'events') seen.push(...e.events.map((x) => x.kind));
    });
    c.open(1);
    expect(c.save.fish).toHaveLength(0); // nobody fed them for 40 hours
    expect(seen).toContain('fishDied');
    c.close();
  });

  it('runs secret console commands', () => {
    const c = new AquariumController(new CookieSaveBackend());
    c.createSlot(1, 'Console');
    const r = c.command('skip');
    expect(r.lines[0]).toMatch(/Skipped/);
    expect(c.save.eggs[0].hatchAt).toBeLessThanOrEqual(c.now());
    c.close();
  });
});

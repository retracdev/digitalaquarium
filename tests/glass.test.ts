import { describe, expect, it } from 'vitest';
import { glassIcon, type GlassIconName } from '../src/ui/glass';

const NAMES: GlassIconName[] = ['fish', 'feed', 'clean', 'collect', 'hatchery', 'shop', 'tank', 'journal', 'photo', 'level', 'heart', 'guide'];

describe('liquid glass icons', () => {
  it('builds every icon as a 64-unit svg at the requested size', () => {
    for (const name of NAMES) {
      const el = glassIcon(name, 40);
      expect(el.tagName.toLowerCase()).toBe('svg');
      expect(el.getAttribute('viewBox')).toBe('0 0 64 64');
      expect(el.getAttribute('width')).toBe('40');
    }
  });

  it('only references ids it defines itself', () => {
    for (const name of NAMES) {
      const el = glassIcon(name);
      const ids = new Set([...el.querySelectorAll('[id]')].map((n) => n.id));
      const refs = [...el.outerHTML.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map((m) => m[1] ?? m[2]);
      expect(refs.length).toBeGreaterThan(10);
      for (const r of refs) expect(ids.has(r), `${name}: #${r}`).toBe(true);
    }
  });

  it('gives each instance its own ids so many icons can share a page', () => {
    const a = glassIcon('fish');
    const b = glassIcon('fish');
    const idsA = [...a.querySelectorAll('[id]')].map((n) => n.id);
    const idsB = new Set([...b.querySelectorAll('[id]')].map((n) => n.id));
    expect(idsA.length).toBeGreaterThan(8);
    expect(idsA.some((id) => idsB.has(id))).toBe(false);
  });

  it('uses well-formed path data that stays inside the tile', () => {
    for (const name of NAMES) {
      const el = glassIcon(name);
      for (const p of el.querySelectorAll('path')) {
        const d = p.getAttribute('d')!;
        expect(d, name).toMatch(/^M[\dMLHVCAZa-z .\-]+$/);
        expect(d, name).not.toMatch(/NaN|undefined/);
        // Absolute coordinates (after stripping relative segments) must sit within the 64 box.
        const abs = d.replace(/[a-z][^A-Z]*/g, ' ').match(/-?\d+(\.\d+)?/g) ?? [];
        for (const v of abs) expect(Math.abs(Number(v)), `${name}: ${v}`).toBeLessThanOrEqual(64);
      }
    }
  });

  it('can re-colour an icon with another palette', () => {
    const violet = glassIcon('fish').outerHTML;
    const aqua = glassIcon('fish', 40, 'aqua').outerHTML;
    expect(violet).toContain('#9C7BF2');
    expect(aqua).toContain('#3FD3C6');
    expect(aqua).not.toContain('#9C7BF2');
  });
});

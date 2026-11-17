/**
 * The secret keeper's console. Open it in the app with the backquote key (`),
 * or from browser devtools: `aquarium("skip")`.
 *
 * These commands exist for testing the hour-long waits, so they intentionally
 * bypass every rule in the simulation.
 */
import { DECOR_BY_ID, PLANTS_BY_ID, SPECIES, SPECIES_BY_ID, MYSTERY_EGG } from './catalog';
import { grantXp, levelFromXp, xpForLevel } from './progress';
import { uid } from './rng';
import { newFish, type SaveData, type SimEvent } from './state';
import { detectedTimeZone, formatClock, formatDuration, parseDuration } from './time';

export interface ConsoleHost {
  save: SaveData;
  now(): number;
  /** Re-run the simulation up to now() (after a warp). */
  resync(): SimEvent[];
}

export interface ConsoleOutput {
  lines: string[];
  changed: boolean;
}

export const COMMANDS: { name: string; usage: string; help: string }[] = [
  { name: 'help', usage: 'help', help: 'List commands.' },
  { name: 'skip', usage: 'skip [all|eggs|plants|upgrades|chests|fish]', help: 'Finish waiting timers instantly (default: all).' },
  { name: 'warp', usage: 'warp <duration>', help: 'Jump the clock forward, e.g. warp 2h, warp 1d. Fish get hungry!' },
  { name: 'shells', usage: 'shells <n>', help: 'Add shells (negative to remove).' },
  { name: 'xp', usage: 'xp <n>', help: 'Grant XP (level-ups and rewards apply).' },
  { name: 'level', usage: 'level <n>', help: 'Jump straight to a level.' },
  { name: 'spawn', usage: 'spawn <species> [count]', help: 'Spawn fish directly. `spawn list` shows ids.' },
  { name: 'egg', usage: 'egg <species|mystery>', help: 'Drop an egg into the hatchery, ready to hatch.' },
  { name: 'starve', usage: 'starve', help: 'Make every fish starving (for testing).' },
  { name: 'heal', usage: 'heal', help: 'Fully heal and feed every fish.' },
  { name: 'water', usage: 'water <0-100>', help: 'Set water cleanliness.' },
  { name: 'time', usage: 'time', help: 'Show the simulation clock and offset.' },
  { name: 'resettime', usage: 'resettime', help: 'Remove the warp offset (does not undo simulated time).' },
  { name: 'status', usage: 'status', help: 'Quick dump of the tank.' },
];

export function runCommand(host: ConsoleHost, input: string): ConsoleOutput {
  const [cmdRaw, ...args] = input.trim().split(/\s+/);
  const cmd = (cmdRaw ?? '').toLowerCase();
  const save = host.save;
  const now = host.now();
  const out = (lines: string[] | string, changed = false): ConsoleOutput => ({ lines: Array.isArray(lines) ? lines : [lines], changed });

  switch (cmd) {
    case '':
      return out([]);
    case 'help':
    case '?':
      return out(COMMANDS.map((c) => `${c.usage.padEnd(34)} ${c.help}`));

    case 'skip': {
      const what = (args[0] ?? 'all').toLowerCase();
      const all = what === 'all';
      let n = 0;
      if (all || what === 'eggs')
        for (const e of save.eggs) if (e.hatchAt > now) (e.hatchAt = now), n++;
      if (all || what === 'upgrades')
        for (const p of save.pending) if (p.readyAt > now) (p.readyAt = now), n++;
      if (all || what === 'plants')
        for (const p of save.plants) {
          const def = PLANTS_BY_ID.get(p.type);
          if (def && now - p.plantedAt < def.growMs) (p.plantedAt = now - def.growMs), n++;
        }
      if (all || what === 'chests')
        for (const d of save.decor) if (d.lootAt !== undefined && d.lootAt > now) (d.lootAt = now), n++;
      if (all || what === 'fish')
        for (const f of save.fish) {
          const def = SPECIES_BY_ID.get(f.species)!;
          if (now - f.bornAt < def.growMs) (f.bornAt = now - def.growMs), n++;
        }
      if (!['all', 'eggs', 'upgrades', 'plants', 'chests', 'fish'].includes(what)) return out(`Unknown target "${what}".`);
      save.lastTick = Math.min(save.lastTick, now - 1);
      const events = host.resync();
      return out([`Skipped ${n} timer${n === 1 ? '' : 's'}.`, ...events.map((e) => `  • ${e.text}`)], true);
    }

    case 'warp': {
      const ms = parseDuration(args.join(''));
      if (!ms) return out('Usage: warp <duration>  e.g. warp 90m, warp 2h, warp 1d');
      save.timeOffset += ms;
      const events = host.resync();
      return out([`Warped ${formatDuration(ms)} into the future.`, ...events.slice(-12).map((e) => `  • ${e.text}`)], true);
    }

    case 'shells': {
      const n = Number(args[0]);
      if (!Number.isFinite(n)) return out('Usage: shells <n>');
      save.shells = Math.max(0, Math.round(save.shells + n));
      return out(`Shells: ${save.shells}`, true);
    }

    case 'xp': {
      const n = Number(args[0]);
      if (!Number.isFinite(n) || n <= 0) return out('Usage: xp <n>');
      const events: SimEvent[] = [];
      grantXp(save, n, now, events);
      return out([`XP: ${save.xp} (level ${save.level})`, ...events.map((e) => `  • ${e.text}`)], true);
    }

    case 'level': {
      const n = Math.floor(Number(args[0]));
      if (!Number.isFinite(n) || n < 1) return out('Usage: level <n>');
      const target = xpForLevel(n);
      if (target > save.xp) {
        const events: SimEvent[] = [];
        grantXp(save, target - save.xp, now, events);
      } else {
        save.xp = target;
        save.level = levelFromXp(target);
      }
      return out(`Now level ${save.level}.`, true);
    }

    case 'spawn': {
      if (!args[0] || args[0] === 'list') return out(SPECIES.map((s) => `${s.id.padEnd(16)} ${s.name}`));
      const def = SPECIES_BY_ID.get(args[0]);
      if (!def) return out(`Unknown species "${args[0]}". Try: spawn list`);
      const count = Math.min(30, Math.max(1, Math.floor(Number(args[1] ?? 1)) || 1));
      for (let i = 0; i < count; i++) save.fish.push(newFish(def.id, now, undefined, true));
      return out(`Spawned ${count} ${def.name}.`, true);
    }

    case 'egg': {
      const id = args[0] ?? '';
      if (id !== MYSTERY_EGG.id && !SPECIES_BY_ID.has(id)) return out('Usage: egg <species|mystery>');
      save.eggs.push({ id: uid(), species: id, laidAt: now, hatchAt: now });
      host.resync();
      return out('An egg appeared in the hatchery.', true);
    }

    case 'starve':
      for (const f of save.fish) f.hunger = 100;
      return out('Every fish is now starving. Feed them before their health runs out!', true);

    case 'heal':
      for (const f of save.fish) (f.health = 100), (f.hunger = 0);
      return out('Everyone is fed and healthy.', true);

    case 'water': {
      const n = Number(args[0]);
      if (!Number.isFinite(n)) return out('Usage: water <0-100>');
      save.water = Math.max(0, Math.min(100, n));
      return out(`Water: ${save.water}%`, true);
    }

    case 'time':
      return out([
        `Tank clock: ${formatClock(now, save.timeZone)} (${save.timeZone || `${detectedTimeZone()}, auto`})`,
        `Real time (UTC): ${new Date(Date.now()).toISOString()}`,
        `Warp offset: ${save.timeOffset ? formatDuration(save.timeOffset) : 'none'}`,
      ]);

    case 'resettime':
      save.timeOffset = 0;
      save.lastTick = Math.min(save.lastTick, host.now());
      return out('Warp offset cleared.', true);

    case 'status':
      return out([
        `${save.name} · level ${save.level} · ${save.xp} xp · ${save.shells} shells`,
        `water ${save.water.toFixed(1)}% · ${save.fish.length} fish · ${save.plants.length} plants · ${save.decor.filter((d) => DECOR_BY_ID.has(d.type)).length} decor · ${save.eggs.length} eggs`,
        ...save.fish.map((f) => `  ${f.name.padEnd(10)} ${f.species.padEnd(14)} hunger ${f.hunger.toFixed(0).padStart(3)} health ${f.health.toFixed(0).padStart(3)} happy ${f.happiness.toFixed(0).padStart(3)}`),
      ]);

    default:
      return out(`Unknown command "${cmd}". Type help.`);
  }
}

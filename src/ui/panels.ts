import type { AquariumController } from '../app/controller';
import { upgradeTiers } from '../core/actions';
import {
  DECOR,
  FEEDER_PORTION_COST,
  FEEDER_TIERS,
  FILTER_TIERS,
  TANK_TIERS,
  MEDICINE_COST,
  MEDICINE_UNLOCK,
  MYSTERY_EGG,
  PLANTS,
  SPECIES,
  SPECIES_BY_ID,
  THEMES,
  hatcherySlots,
  type SpeciesDef,
} from '../core/catalog';
import { ACHIEVEMENTS } from '../core/progress';
import { feederCapacity, fishGrowth, tankStats } from '../core/sim';
import type { UpgradeKind } from '../core/state';
import { detectedTimeZone, formatAgo, formatClock, formatDuration, timeZoneList } from '../core/time';
import { fmt, h } from './dom';
import { shellIcon } from './icons';

export type PanelName = 'shop' | 'hatchery' | 'tank' | 'journal';

export interface PanelHost {
  ctrl: AquariumController;
  tab: Record<PanelName, string>;
  setTab(panel: PanelName, tab: string): void;
  place(kind: 'plant' | 'decor', type: string): void;
  inspectFish(id: string): void;
  close(): void;
}

export const costBtn = (cost: number, opts: { disabled?: boolean; onclick: () => void; label?: string; cls?: string }) =>
  h('button', { class: `btn small ${opts.cls ?? 'primary'}`, disabled: !!opts.disabled, onclick: opts.onclick }, opts.label ? opts.label + ' ' : '', shellIcon(), fmt(cost));

export const bar = (pct: number, cls = '') => h('div', { class: `bar ${cls}` }, h('i', { style: `width:${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%` }));

/** A countdown that the UI refreshes every second without re-rendering. */
export const until = (at: number, readyText = 'Ready!') => h('span', { 'data-until': String(at), 'data-ready': readyText }, '');
export const timedBar = (from: number, to: number) =>
  h('div', { class: 'bar', 'data-from': String(from), 'data-to': String(to) }, h('i', { style: 'width:0%' }));

export function fishSwatch(def: SpeciesDef): HTMLElement {
  return h('div', {
    class: 'swatch fish',
    style: `background: radial-gradient(circle at 70% 40%, ${def.look.body} 0 45%, ${def.look.accent} 46% 60%, ${def.look.fin ?? def.look.body} 61%);${def.look.glow ? `box-shadow:0 0 16px ${def.look.accent}` : ''}`,
  });
}

export function eggStyle(species: string): string {
  if (species === MYSTERY_EGG.id) return 'background: conic-gradient(from 30deg, #b9b2ff, #6fe3d6, #ffd9a8, #ff8fb1, #b9b2ff)';
  const def = SPECIES_BY_ID.get(species);
  return `background: radial-gradient(circle at 35% 30%, #ffffffaa, transparent 30%), linear-gradient(160deg, ${def?.look.body ?? '#ccc'}, ${def?.look.accent ?? '#888'})`;
}

const rarityChip = (r: string) => h('span', { class: `chip rarity-${r}` }, r);

// ------------------------------------------------------------------ Shop

export function shopPanel(host: PanelHost): HTMLElement[] {
  const { ctrl } = host;
  const s = ctrl.save;
  const tab = host.tab.shop;
  const out: HTMLElement[] = [];
  const slotsUsed = s.eggs.length;
  const slotsMax = hatcherySlots(s.level);

  if (tab === 'eggs') {
    const stats = tankStats(s, ctrl.now());
    out.push(
      h(
        'div',
        { class: 'row muted', style: 'font-size:12px;font-weight:700;padding:0 4px' },
        `Hatchery ${slotsUsed}/${slotsMax}`,
        h('span', { class: 'spacer' }),
        `Tank space ${stats.load}/${stats.capacity}`,
      ),
    );
    const mysteryLocked = s.level < MYSTERY_EGG.unlockLevel;
    const items: (SpeciesDef | 'mystery')[] = [...SPECIES.slice(0, 7), 'mystery', ...SPECIES.slice(7)];
    for (const item of items) {
      if (item === 'mystery') {
        out.push(
          h(
            'div',
            { class: `card${mysteryLocked ? ' locked' : ''}` },
            h('div', { class: 'egg', style: eggStyle('mystery') }),
            h(
              'div',
              { class: 'grow' },
              h('h3', null, MYSTERY_EGG.name, rarityChip('rare')),
              h('p', null, MYSTERY_EGG.blurb),
              h('div', { class: 'meta' }, h('span', null, 'Hatches in ', h('b', null, formatDuration(MYSTERY_EGG.hatchMs)))),
            ),
            h(
              'div',
              { class: 'actions' },
              mysteryLocked
                ? h('span', { class: 'chip' }, `Lv ${MYSTERY_EGG.unlockLevel}`)
                : costBtn(MYSTERY_EGG.cost, { disabled: s.shells < MYSTERY_EGG.cost || slotsUsed >= slotsMax, onclick: () => ctrl.buyEgg('mystery') }),
            ),
          ),
        );
        continue;
      }
      const def = item;
      const locked = s.level < def.unlockLevel;
      out.push(
        h(
          'div',
          { class: `card${locked ? ' locked' : ''}` },
          fishSwatch(def),
          h(
            'div',
            { class: 'grow' },
            h('h3', null, def.name, rarityChip(def.rarity)),
            h('p', null, def.blurb),
            h(
              'div',
              { class: 'meta' },
              h('span', null, 'Hatch ', h('b', null, formatDuration(def.hatchMs))),
              h('span', null, 'Grow ', h('b', null, formatDuration(def.growMs))),
              h('span', null, h('b', null, `${def.shellsPerHour}`), ' shells/hr'),
              h('span', null, 'Space ', h('b', null, String(def.bioload))),
            ),
          ),
          h(
            'div',
            { class: 'actions' },
            locked
              ? h('span', { class: 'chip' }, `Lv ${def.unlockLevel}`)
              : costBtn(def.cost, { disabled: s.shells < def.cost || slotsUsed >= slotsMax, onclick: () => ctrl.buyEgg(def.id) }),
          ),
        ),
      );
    }
  } else {
    const list = tab === 'plants' ? PLANTS : DECOR;
    const kind = tab === 'plants' ? 'plant' : 'decor';
    out.push(h('p', { class: 'muted', style: 'font-size:12px;margin:0 4px' }, 'Buy, then click the sand to place it. You can move things later by clicking them.'));
    for (const def of list) {
      const locked = s.level < def.unlockLevel;
      const p = 'growMs' in def ? def : null;
      const d = 'oxygen' in def || 'lootEveryMs' in def || !p ? (def as (typeof DECOR)[number]) : null;
      out.push(
        h(
          'div',
          { class: `card${locked ? ' locked' : ''}` },
          h('div', { class: 'swatch', style: `background:${swatchFor(def.id)}` }),
          h(
            'div',
            { class: 'grow' },
            h('h3', null, def.name, def.glow ? h('span', { class: 'chip rarity-rare' }, 'glows') : null),
            h('p', null, def.blurb),
            h(
              'div',
              { class: 'meta' },
              p ? h('span', null, 'Grows in ', h('b', null, formatDuration(p.growMs))) : null,
              p ? h('span', null, 'Cleans ', h('b', null, `${p.cleanPerHour}%/hr`)) : null,
              h('span', null, 'Happiness ', h('b', null, `+${def.happiness}`)),
              d?.oxygen ? h('span', null, h('b', null, `-${Math.round((1 - d.oxygen) * 100)}%`), ' water decay') : null,
              d?.lootEveryMs ? h('span', null, 'Loot every ', h('b', null, formatDuration(d.lootEveryMs))) : null,
            ),
          ),
          h(
            'div',
            { class: 'actions' },
            locked
              ? h('span', { class: 'chip' }, `Lv ${def.unlockLevel}`)
              : costBtn(def.cost, { disabled: s.shells < def.cost, onclick: () => host.place(kind, def.id) }),
          ),
        ),
      );
    }
  }
  return out;
}

function swatchFor(id: string): string {
  const map: Record<string, string> = {
    java_fern: 'linear-gradient(160deg,#3f9a47,#1f4f26)',
    eelgrass: 'repeating-linear-gradient(100deg,#7cc35a 0 5px,#4d8a3a 5px 9px)',
    moss_ball: 'radial-gradient(circle at 40% 35%,#4b8c3f,#1f4a1c)',
    red_ludwigia: 'linear-gradient(180deg,#e0523f,#6aa83f)',
    kelp: 'linear-gradient(180deg,#a39a45,#5d5b22)',
    glow_coral: 'radial-gradient(circle,#ffb3d6,#ff5fa2 50%,#5a1f3a)',
    anemone: 'radial-gradient(circle at 50% 80%,#ff8fd8,#8a3d6e)',
    starbloom: 'radial-gradient(circle,#fff1b8,#ffcf5a 40%,#3c7a5a 75%)',
    rocks: 'radial-gradient(circle at 35% 35%,#a09a8c,#5b5d66)',
    driftwood: 'linear-gradient(135deg,#8a6240,#4a311c)',
    airstone: 'radial-gradient(circle at 50% 70%,#3d5a73 30%,#9fe8ff 32% 36%,#0f2433 38%)',
    treasure_chest: 'linear-gradient(180deg,#e3b341 0 18%,#7a4a26 20%)',
    castle: 'linear-gradient(180deg,#7d4e8f 0 30%,#b8b2a6 32%)',
    arch: 'radial-gradient(circle at 50% 100%,transparent 35%,#8d7f6e 37% 60%,#2a2633 62%)',
    amphora: 'radial-gradient(ellipse at 50% 60%,#b8643a 40%,#2a1a14 70%)',
    geode: 'radial-gradient(circle,#e2c7ff,#a065ff 45%,#3b3448 70%)',
    volcano: 'radial-gradient(circle at 50% 20%,#ff6a2b 12%,#4a3b3b 30%)',
    satellite: 'linear-gradient(90deg,#2a3f8f 0 30%,#d6a63a 30% 70%,#2a3f8f 70%)',
  };
  return map[id] ?? 'var(--raise-2)';
}

// ------------------------------------------------------------------ Hatchery

export function hatcheryPanel(host: PanelHost): HTMLElement[] {
  const { ctrl } = host;
  const s = ctrl.save;
  const now = ctrl.now();
  const max = hatcherySlots(s.level);
  const out: HTMLElement[] = [];
  const stats = tankStats(s, now);
  out.push(h('p', { class: 'muted', style: 'font-size:12px;margin:0 4px' }, `Eggs incubate in real time — come back when they are ready. Tank space ${stats.load}/${stats.capacity}.`));
  for (const egg of s.eggs) {
    const def = SPECIES_BY_ID.get(egg.species);
    const ready = egg.hatchAt <= now;
    out.push(
      h(
        'div',
        { class: 'card' },
        h('div', { class: `egg${ready ? ' ready' : ''}`, style: eggStyle(egg.species) }),
        h(
          'div',
          { class: 'grow' },
          h('h3', null, def ? `${def.name} egg` : MYSTERY_EGG.name),
          h('p', null, ready ? 'Something is wiggling in there…' : h('span', null, 'Hatches in ', until(egg.hatchAt))),
          h('div', { style: 'margin-top:8px' }, timedBar(egg.laidAt, egg.hatchAt)),
        ),
        h('div', { class: 'actions' }, h('button', { class: 'btn small aqua', disabled: !ready, onclick: () => ctrl.hatch(egg.id) }, ready ? 'Hatch!' : 'Incubating')),
      ),
    );
  }
  for (let i = s.eggs.length; i < max; i++)
    out.push(h('div', { class: 'empty' }, 'Empty incubator · ', h('button', { class: 'btn small', onclick: () => host.setTab('shop', 'eggs') }, 'Buy an egg')));
  const nextUnlock = [5, 10, 15].find((l) => l > s.level);
  if (max < 5 && nextUnlock) out.push(h('div', { class: 'empty', style: 'opacity:.5' }, `Another incubator unlocks at level ${nextUnlock}`));
  return out;
}

// ------------------------------------------------------------------ Tank

export function tankPanel(host: PanelHost): HTMLElement[] {
  const { ctrl } = host;
  const s = ctrl.save;
  const now = ctrl.now();
  const stats = tankStats(s, now);
  const out: HTMLElement[] = [];
  const tab = host.tab.tank;

  if (tab === 'care') {
    const net = stats.cleanPerHour - stats.decayPerHour;
    out.push(
      h('div', { class: 'section-title' }, 'Water'),
      h(
        'div',
        { class: 'card', style: 'flex-direction:column;align-items:stretch' },
        h('div', { class: 'row' }, h('b', null, `${Math.round(s.water)}% clean`), h('span', { class: 'spacer' }), h('button', { class: 'btn small aqua', onclick: () => ctrl.clean() }, 'Clean now')),
        bar(s.water / 100, s.water < 25 ? 'bad' : s.water < 50 ? 'warn' : 'good'),
        h(
          'div',
          { class: 'kv' },
          h('span', null, 'Dirtying per hour'),
          h('span', null, `${stats.decayPerHour.toFixed(1)}%`),
          h('span', null, 'Plants clean per hour'),
          h('span', null, `${stats.cleanPerHour.toFixed(1)}%`),
          h('span', null, 'Net'),
          h('span', { style: `color:${net >= 0 ? 'var(--good)' : 'var(--warn)'}` }, `${net >= 0 ? '+' : ''}${net.toFixed(1)}%/hr`),
          h('span', null, 'Tank space used'),
          h('span', null, `${stats.load} / ${stats.capacity}`),
        ),
      ),
    );
    const cap = feederCapacity(s);
    out.push(h('div', { class: 'section-title' }, 'Care'));
    if (cap) {
      out.push(
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'grow' }, h('h3', null, FEEDER_TIERS[s.upgrades.feeder].name), h('p', null, `${s.feederPortions}/${cap} portions. Feeds automatically when someone gets hungry.`)),
          costBtn((cap - s.feederPortions) * FEEDER_PORTION_COST, { label: 'Refill', disabled: s.feederPortions >= cap, onclick: () => ctrl.refill() }),
        ),
      );
    }
    const medLocked = s.level < MEDICINE_UNLOCK;
    out.push(
      h(
        'div',
        { class: `card${medLocked ? ' locked' : ''}` },
        h('div', { class: 'grow' }, h('h3', null, 'Fish Medicine'), h('p', null, 'Restores +50 health to every fish. For emergencies.')),
        medLocked ? h('span', { class: 'chip' }, `Lv ${MEDICINE_UNLOCK}`) : costBtn(MEDICINE_COST, { label: 'Give', disabled: s.shells < MEDICINE_COST, onclick: () => ctrl.medicine() }),
      ),
    );
    out.push(h('div', { class: 'section-title' }, 'Lights'));
    const seg = h('div', { class: 'seg' });
    for (const mode of ['auto', 'day', 'night'] as const)
      seg.append(h('button', { class: s.lights === mode ? 'on' : '', onclick: () => ctrl.lights(mode) }, mode === 'auto' ? 'Follow clock' : mode === 'day' ? 'Always day' : 'Always night'));
    out.push(h('div', { class: 'card', style: 'flex-direction:column;align-items:flex-start' }, seg, h('p', null, 'Glowing creatures shine brightest at night.')));
    const detected = detectedTimeZone();
    const tzSelect = h(
      'select',
      { class: 'text', 'aria-label': 'Time zone', onchange: (e: Event) => ctrl.setTimeZone((e.target as HTMLSelectElement).value) },
      h('option', { value: '' }, `Auto: ${detected.replace(/_/g, ' ')}`),
      ...timeZoneList().map((z) => h('option', { value: z }, z.replace(/_/g, ' '))),
    ) as HTMLSelectElement;
    tzSelect.value = s.timeZone;
    out.push(
      h('div', { class: 'section-title' }, 'Time zone'),
      h(
        'div',
        { class: 'card', style: 'flex-direction:column;align-items:stretch' },
        tzSelect,
        h('p', null, `Drives the clock, day and night, and your daily streak. It is ${formatClock(now, s.timeZone)} in the tank right now.`),
      ),
    );
    const input = h('input', { class: 'text', value: s.name, maxlength: '24' }) as HTMLInputElement;
    input.addEventListener('keydown', (e) => e.key === 'Enter' && ctrl.renameTank(input.value));
    out.push(h('div', { class: 'section-title' }, 'Tank name'), h('div', { class: 'row' }, input, h('button', { class: 'btn', onclick: () => ctrl.renameTank(input.value) }, 'Save')));
  } else if (tab === 'upgrades') {
    const labels: Record<UpgradeKind, string> = { tank: 'Tank size', filter: 'Filter', feeder: 'Auto-feeder' };
    const blurbs: Record<UpgradeKind, (i: number) => string> = {
      tank: (i) => `Room for ${TANK_TIERS[i].capacity} space worth of fish. The tank gets wider, too.`,
      filter: (i) => `Water dirties ${Math.round((1 - FILTER_TIERS[i].decayMult) * 100)}% slower.`,
      feeder: (i) => `Holds ${FEEDER_TIERS[i].portions} portions and feeds hungry fish automatically.`,
    };
    for (const kind of ['tank', 'filter', 'feeder'] as UpgradeKind[]) {
      const tiers = upgradeTiers(kind);
      const cur = s.upgrades[kind];
      const next = tiers[cur + 1];
      const pending = s.pending.find((p) => p.kind === kind);
      out.push(h('div', { class: 'section-title' }, labels[kind]));
      const current = h('div', { class: 'meta' }, h('span', null, 'Current: ', h('b', null, tiers[cur].name)));
      if (pending) {
        out.push(
          h(
            'div',
            { class: 'card', style: 'flex-direction:column;align-items:stretch' },
            h('h3', null, `Installing ${tiers[pending.tier].name}…`),
            h('p', null, 'Ready in ', until(pending.readyAt, 'any second now')),
            timedBar(pending.readyAt - tiers[pending.tier].installMs, pending.readyAt),
          ),
        );
      } else if (next) {
        const locked = s.level < next.unlockLevel;
        out.push(
          h(
            'div',
            { class: `card${locked ? ' locked' : ''}` },
            h(
              'div',
              { class: 'grow' },
              h('h3', null, next.name),
              h('p', null, blurbs[kind](cur + 1)),
              h('div', { class: 'meta' }, h('span', null, 'Install time ', h('b', null, formatDuration(next.installMs)))),
              current,
            ),
            locked ? h('span', { class: 'chip' }, `Lv ${next.unlockLevel}`) : costBtn(next.cost, { disabled: s.shells < next.cost, onclick: () => ctrl.upgrade(kind) }),
          ),
        );
      } else {
        out.push(h('div', { class: 'card' }, h('div', { class: 'grow' }, h('h3', null, tiers[cur].name), h('p', null, 'Fully upgraded. Fancy!'))));
      }
    }
  } else {
    for (const t of THEMES) {
      const owned = s.themesOwned.includes(t.id);
      const active = s.theme === t.id;
      const locked = !owned && s.level < t.unlockLevel;
      out.push(
        h(
          'div',
          { class: `card${locked ? ' locked' : ''}` },
          h('div', { class: 'theme-swatch', style: `background:linear-gradient(180deg,${t.top},${t.bottom} 70%,${t.sand} 71%)` }),
          h('div', { class: 'grow' }, h('h3', null, t.name, active ? h('span', { class: 'chip good' }, 'active') : null), h('p', null, t.blurb)),
          active
            ? null
            : owned
              ? h('button', { class: 'btn small', onclick: () => ctrl.theme(t.id) }, 'Apply')
              : locked
                ? h('span', { class: 'chip' }, `Lv ${t.unlockLevel}`)
                : costBtn(t.cost, { disabled: s.shells < t.cost, onclick: () => ctrl.theme(t.id) }),
        ),
      );
    }
  }
  return out;
}

// ------------------------------------------------------------------ Journal

export function journalPanel(host: PanelHost): HTMLElement[] {
  const { ctrl } = host;
  const s = ctrl.save;
  const now = ctrl.now();
  const tab = host.tab.journal;
  const out: HTMLElement[] = [];
  if (tab === 'fish') {
    if (!s.fish.length) out.push(h('div', { class: 'empty' }, 'No fish yet. Visit the Hatchery!'));
    const sorted = [...s.fish].sort((a, b) => b.hunger - a.hunger);
    for (const f of sorted) {
      const def = SPECIES_BY_ID.get(f.species)!;
      const growth = fishGrowth(f, now);
      out.push(
        h(
          'div',
          { class: 'card', style: 'cursor:pointer', onclick: () => host.inspectFish(f.id) },
          fishSwatch(def),
          h(
            'div',
            { class: 'grow' },
            h('h3', null, f.name, h('span', { class: 'muted', style: 'font-weight:600;font-size:12px' }, def.name)),
            h(
              'div',
              { class: 'meta' },
              h('span', { style: f.hunger >= 70 ? 'color:var(--warn)' : '' }, `Fullness ${Math.round(100 - f.hunger)}%`),
              h('span', { style: f.health < 40 ? 'color:var(--bad)' : '' }, `Health ${Math.round(f.health)}%`),
              h('span', null, `Mood ${Math.round(f.happiness)}%`),
              h('span', null, growth < 1 ? 'Growing' : 'Adult'),
            ),
          ),
        ),
      );
    }
  } else if (tab === 'milestones') {
    for (const a of ACHIEVEMENTS) {
      const done = s.achievements.includes(a.id);
      out.push(
        h(
          'div',
          { class: `card${done ? '' : ' locked'}` },
          h('div', { class: 'grow' }, h('h3', null, a.name, done ? h('span', { class: 'chip good' }, 'done') : null), h('p', null, a.desc)),
          h('span', { class: 'chip' }, shellIcon(), fmt(a.reward)),
        ),
      );
    }
    out.push(
      h('div', { class: 'section-title' }, 'Stats'),
      h(
        'div',
        { class: 'kv card', style: 'display:grid' },
        ...([
          ['Times fed', s.stats.fed],
          ['Tank cleans', s.stats.cleaned],
          ['Eggs hatched', s.stats.hatched],
          ['Shells earned', fmt(s.stats.shellsEarned)],
          ['Chests opened', s.stats.chestsOpened],
          ['Fish rehomed', s.stats.rehomed],
          ['Fish lost', s.stats.fishLost],
          ['Visit streak', `${s.streak} day${s.streak === 1 ? '' : 's'}`],
        ] as const).flatMap(([k, v]) => [h('span', null, k), h('span', null, String(v))]),
      ),
    );
  } else if (tab === 'log') {
    if (!s.log.length) out.push(h('div', { class: 'empty' }, 'Nothing has happened yet. Give it time.'));
    for (const e of [...s.log].reverse())
      out.push(h('div', { class: `log-item ${e.tone}` }, h('time', null, formatAgo(now - e.at)), h('span', null, e.text)));
  } else {
    if (!s.memorial.length) out.push(h('div', { class: 'empty' }, 'No fish lost. Keep it that way — feed them every day!'));
    for (const m of [...s.memorial].reverse()) {
      const def = SPECIES_BY_ID.get(m.species);
      out.push(
        h(
          'div',
          { class: 'card' },
          def ? fishSwatch(def) : null,
          h(
            'div',
            { class: 'grow' },
            h('h3', null, m.name, h('span', { class: 'muted', style: 'font-weight:600;font-size:12px' }, def?.name ?? '')),
            h('p', null, `Lived ${formatDuration(m.diedAt - m.bornAt)} · ${m.cause === 'starvation' ? 'went hungry' : 'dirty water'} · ${formatAgo(now - m.diedAt)}`),
          ),
        ),
      );
    }
  }
  return out;
}

export const PANEL_TABS: Record<PanelName, { id: string; label: string }[]> = {
  shop: [
    { id: 'eggs', label: 'Fish eggs' },
    { id: 'plants', label: 'Plants' },
    { id: 'decor', label: 'Decor' },
  ],
  hatchery: [],
  tank: [
    { id: 'care', label: 'Care' },
    { id: 'upgrades', label: 'Upgrades' },
    { id: 'themes', label: 'Themes' },
  ],
  journal: [
    { id: 'fish', label: 'My fish' },
    { id: 'milestones', label: 'Milestones' },
    { id: 'log', label: 'Log' },
    { id: 'memorial', label: 'Memorial' },
  ],
};

export const PANEL_TITLES: Record<PanelName, string> = { shop: 'Shop', hatchery: 'Hatchery', tank: 'Tank', journal: 'Journal' };

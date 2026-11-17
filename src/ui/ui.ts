import type { AquariumController } from '../app/controller';
import { alerts } from '../core/actions';
import { DECOR_BY_ID, PLANTS_BY_ID, SPECIES_BY_ID } from '../core/catalog';
import { levelProgress, MAX_LEVEL } from '../core/progress';
import { fishGrowth, HUNGRY, pendingCap, plantProgress, targetHappiness, tankStats } from '../core/sim';
import type { SimEvent } from '../core/state';
import { detectedTimeZone, formatAgo, formatClock, formatDuration } from '../core/time';
import type { AquariumScene, PickResult } from '../render/scene';
import { daylightAt } from '../render/scene';
import { DevConsole } from './console';
import { fmt, h } from './dom';
import { icon, shellIcon, type IconName } from './icons';
import { bar, costBtn, fishSwatch, hatcheryPanel, journalPanel, PANEL_TABS, PANEL_TITLES, shopPanel, tankPanel, timedBar, until, type PanelHost, type PanelName } from './panels';
import { slotMenu, titleScreen } from './slots';
import { Tutorial } from './tutorial';

const LOGO = `${import.meta.env.BASE_URL}retrac-space-logo.png`;
const QUALITY_KEY = 'daq_quality';

export class UI implements PanelHost {
  private hudLeft = h('div', { class: 'hud-left' });
  private hudRight = h('div', { class: 'hud-right glass' });
  private dock = h('nav', { class: 'dock glass' });
  private toasts = h('div', { class: 'toasts' });
  private tooltip = h('div', { class: 'tooltip', style: 'display:none' });
  private panelEl: HTMLElement | null = null;
  private panelBody: HTMLElement | null = null;
  private panelSig = '';
  private inspectorEl: HTMLElement | null = null;
  private inspectorSig = '';
  private title: HTMLElement | null = null;
  private menu: HTMLElement | null = null;
  private placementBar: HTMLElement | null = null;
  private console: DevConsole;
  readonly tutorial: Tutorial;
  private dockButtons = new Map<string, HTMLButtonElement>();
  private hudParts!: Record<'lvl' | 'lvlXp' | 'lvlBar' | 'shells' | 'water' | 'clock' | 'clockIcon' | 'slotName' | 'alerts', HTMLElement>;
  private pointerDownInPanel = false;

  panel: PanelName | null = null;
  inspecting: PickResult | null = null;
  tab: Record<PanelName, string> = { shop: 'eggs', hatchery: '', tank: 'care', journal: 'fish' };

  constructor(
    private root: HTMLElement,
    readonly ctrl: AquariumController,
    private scene: AquariumScene,
  ) {
    this.console = new DevConsole(root, ctrl);
    this.tutorial = new Tutorial(root, ctrl);
    this.buildHud();
    this.buildDock();
    root.append(this.toasts, this.tooltip);
    this.bindKeys();

    scene.onHover = (info) => {
      if (!info) return void (this.tooltip.style.display = 'none');
      this.tooltip.style.display = 'block';
      this.tooltip.textContent = info.text;
      this.tooltip.style.left = `${info.x}px`;
      this.tooltip.style.top = `${info.y}px`;
    };
    scene.onPick = (p) => this.handlePick(p);
    scene.onPlace = (req, nx, nz, rot) => {
      if (req.moveId) ctrl.move(req.moveId, nx, nz);
      else if (req.kind === 'plant') ctrl.buyPlant(req.type, nx, nz);
      else ctrl.buyDecor(req.type, nx, nz, rot);
    };
    scene.onPlacementEnd = () => this.hidePlacementBar();

    const q = safeGet(QUALITY_KEY);
    if (q === 'low') scene.setQuality('low');

    ctrl.on((e) => {
      if (e.type === 'state') this.refresh();
      else if (e.type === 'toast') this.toast(e.text, e.tone);
      else if (e.type === 'events') this.handleEvents(e.events, e.away);
      else if (e.type === 'action') this.handleAction(e.name, e.data);
      else if (e.type === 'slot') this.onSlotChanged();
    });
  }

  // ------------------------------------------------------------ title / slots

  showTitle(): void {
    this.closePanel();
    this.closeInspector();
    this.closeMenu();
    this.tutorial.hide();
    this.title?.remove();
    this.title = titleScreen(this.ctrl, (slot, name) => this.openSlot(slot, name));
    this.root.append(this.title);
    document.title = 'Digital Aquarium · retrac.space';
  }

  openSlot(slot: number, newName?: string): void {
    this.closeMenu();
    this.scene.clear();
    if (newName !== undefined) this.ctrl.createSlot(slot, newName);
    else this.ctrl.open(slot);
    this.title?.remove();
    this.title = null;
    // Every new tank starts the tutorial; a tank left mid-tutorial picks up where it was.
    this.tutorial.resume();
  }

  private onSlotChanged(): void {
    this.closePanel();
    this.closeInspector();
    this.scene.resetCamera();
    this.refresh();
  }

  // ------------------------------------------------------------ HUD

  private buildHud(): void {
    const slotName = h('span', { class: 'name' });
    const slotBtn = h('button', { class: 'slot-btn', title: 'Switch tank', 'data-tut': 'slots', onclick: (e: Event) => (e.stopPropagation(), this.toggleMenu(slotBtn)) }, h('span', null, 'Tank'), slotName, icon('chevron'));
    slotBtn.querySelector('svg')!.setAttribute('style', 'width:14px;height:14px');
    const alertsEl = h('div', { class: 'alerts' });
    this.hudLeft.append(
      h(
        'div',
        { class: 'brand glass' },
        h('div', { class: 'wordmark' }, h('img', { src: LOGO, alt: 'retrac.space' }), h('span', { class: 'title' }, 'Digital Aquarium')),
        h('div', { style: 'position:relative' }, slotBtn),
      ),
      alertsEl,
    );
    const lvl = h('span');
    const lvlXp = h('small');
    const lvlBar = h('i', { style: 'width:0%' });
    const shells = h('span');
    const water = h('span');
    const clock = h('span');
    const clockIcon = h('span', { style: 'display:flex;width:16px;height:16px' });
    this.hudRight.append(
      h('div', { class: 'stat level', title: 'Level & XP', 'data-tut': 'level' }, h('div', { class: 'row' }, lvl, lvlXp), h('div', { class: 'bar' }, lvlBar)),
      h('div', { class: 'stat', title: 'Shells' }, shellIcon(), shells),
      h('div', { class: 'stat', title: 'Water cleanliness', 'data-tut': 'water' }, (() => {
        const d = icon('drop');
        d.setAttribute('style', 'width:16px;height:16px;color:var(--aqua)');
        return d;
      })(), water),
      h('div', { class: 'stat clock', title: 'Tank clock (follows your local time)' }, clockIcon, clock),
    );
    this.hudParts = { lvl, lvlXp, lvlBar, shells, water, clock, clockIcon, slotName, alerts: alertsEl };
    this.root.append(this.hudLeft, this.hudRight);
  }

  private buildDock(): void {
    const items: [string, string, IconName, () => void, string][] = [
      ['feed', 'Feed', 'feed', () => this.ctrl.feed(), 'F'],
      ['clean', 'Clean', 'clean', () => this.ctrl.clean(), 'C'],
      ['collect', 'Collect', 'collect', () => this.ctrl.collect(), 'G'],
      ['sep', '', 'close', () => {}, ''],
      ['hatchery', 'Hatchery', 'hatchery', () => this.togglePanel('hatchery'), 'H'],
      ['shop', 'Shop', 'shop', () => this.togglePanel('shop'), 'S'],
      ['tank', 'Tank', 'tank', () => this.togglePanel('tank'), 'T'],
      ['journal', 'Journal', 'journal', () => this.togglePanel('journal'), 'J'],
      ['photo', 'Photo', 'photo', () => this.photoMode(), 'P'],
    ];
    for (const [id, label, ic, fn, key] of items) {
      if (id === 'sep') {
        this.dock.append(h('div', { class: 'dock-sep' }));
        continue;
      }
      const btn = h('button', { class: 'dock-btn', title: `${label} (${key})`, 'data-tut': id, onclick: fn }, icon(ic), h('span', { class: 'lbl' }, label));
      this.dockButtons.set(id, btn);
      this.dock.append(btn);
    }
    this.root.append(this.dock);
  }

  private setBadge(id: string, text: string | null, tone = ''): void {
    const btn = this.dockButtons.get(id)!;
    let badge = btn.querySelector('.badge');
    if (!text) return void badge?.remove();
    if (!badge) {
      badge = h('span', { class: 'badge' });
      btn.append(badge);
    }
    badge.className = `badge ${tone}`;
    badge.textContent = text;
  }

  refresh(): void {
    if (!this.ctrl.loaded) return;
    const s = this.ctrl.save;
    const now = this.ctrl.now();
    const p = this.hudParts;
    const lp = levelProgress(s.xp);
    p.lvl.textContent = `Level ${s.level}`;
    p.lvlXp.textContent = s.level >= MAX_LEVEL ? 'max' : `${lp.into}/${lp.needed} xp`;
    p.lvlBar.style.width = `${Math.round(lp.pct * 100)}%`;
    p.shells.textContent = fmt(s.shells);
    p.water.textContent = `${Math.round(s.water)}%`;
    p.water.style.color = s.water < 25 ? 'var(--bad)' : s.water < 50 ? 'var(--warn)' : '';
    p.clock.textContent = formatClock(now, s.timeZone);
    p.clock.parentElement!.title = `Tank clock · ${(s.timeZone || detectedTimeZone()).replace(/_/g, ' ')}${s.timeZone ? '' : ' (auto)'} · change in Tank → Care`;
    const isDay = s.lights === 'day' || (s.lights === 'auto' && daylightAt(now, s.timeZone) > 0.5);
    if (p.clockIcon.dataset.day !== String(isDay)) {
      p.clockIcon.dataset.day = String(isDay);
      p.clockIcon.replaceChildren(icon(isDay ? 'sun' : 'moon'));
    }
    p.slotName.textContent = s.name;

    const al = alerts(s, now);
    p.alerts.replaceChildren(...al.map((a) => h('span', { class: `chip ${a.tone}` }, a.text)));
    document.title = al.length ? `(${al.length}) ${s.name} · Digital Aquarium` : `${s.name} · Digital Aquarium`;

    // Dock state
    const hungry = s.fish.filter((f) => f.hunger >= HUNGRY).length;
    const starving = s.fish.some((f) => f.hunger >= 100);
    const feed = this.dockButtons.get('feed')!;
    feed.classList.toggle('attention', hungry > 0 && !starving);
    feed.classList.toggle('urgent', starving);
    this.setBadge('feed', hungry ? String(hungry) : null, starving ? 'bad' : 'warn');
    const clean = this.dockButtons.get('clean')!;
    clean.classList.toggle('attention', s.water < 50 && s.water >= 25);
    clean.classList.toggle('urgent', s.water < 25);
    this.setBadge('clean', s.water < 50 ? `${Math.round(s.water)}%` : null, s.water < 25 ? 'bad' : 'warn');
    const pend = Math.floor(s.pendingShells);
    this.setBadge('collect', pend >= 1 ? (pend >= pendingCap(s) ? 'full' : fmt(pend)) : null, pend >= pendingCap(s) ? 'warn' : '');
    const ready = s.eggs.filter((e) => e.hatchAt <= now).length;
    this.setBadge('hatchery', ready ? String(ready) : null);
    this.dockButtons.get('hatchery')!.classList.toggle('attention', ready > 0);
    const chestReady = s.decor.some((x) => x.lootAt !== undefined && x.lootAt <= now);
    this.setBadge('tank', s.pending.length ? '⋯' : null);
    if (chestReady) this.setBadge('collect', '!', 'warn');
    for (const [id, btn] of this.dockButtons) btn.classList.toggle('active', this.panel === id);

    this.refreshPanel();
    this.refreshInspector();
    this.updateTimers(this.root);
  }

  /** Countdown text and progress bars tick without rebuilding the DOM. */
  private updateTimers(root: HTMLElement): void {
    const now = this.ctrl.now();
    root.querySelectorAll<HTMLElement>('[data-until]').forEach((el) => {
      const left = Number(el.dataset.until) - now;
      el.textContent = left > 0 ? formatDuration(left) : (el.dataset.ready ?? 'Ready!');
    });
    root.querySelectorAll<HTMLElement>('[data-from]').forEach((el) => {
      const from = Number(el.dataset.from);
      const to = Number(el.dataset.to);
      const pct = to > from ? Math.min(1, Math.max(0, (now - from) / (to - from))) : 1;
      (el.firstElementChild as HTMLElement).style.width = `${Math.round(pct * 100)}%`;
    });
  }

  // ------------------------------------------------------------ panels

  togglePanel(name: PanelName): void {
    if (this.panel === name) return this.closePanel();
    this.openPanel(name);
  }

  openPanel(name: PanelName, tab?: string): void {
    if (!this.ctrl.loaded) return;
    this.scene.cancelPlacement();
    this.panel = name;
    if (tab) this.tab[name] = tab;
    this.panelEl?.remove();
    this.panelEl = h('aside', { class: 'panel glass' });
    this.panelEl.addEventListener('pointerdown', () => (this.pointerDownInPanel = true));
    window.addEventListener('pointerup', () => setTimeout(() => (this.pointerDownInPanel = false), 0));
    this.panelSig = '';
    this.root.append(this.panelEl);
    this.refresh();
    this.tutorial.notify(`panel:${name}`);
  }

  closePanel(): void {
    this.panelEl?.remove();
    this.panelEl = null;
    this.panelBody = null;
    this.panel = null;
    for (const btn of this.dockButtons.values()) btn.classList.remove('active');
  }

  close(): void {
    this.closePanel();
  }

  setTab(panel: PanelName, tab: string): void {
    if (this.panel !== panel) this.openPanel(panel, tab);
    else {
      this.tab[panel] = tab;
      this.panelSig = '';
      this.refreshPanel(true);
    }
  }

  private signature(): string {
    const s = this.ctrl.save;
    const now = this.ctrl.now();
    const base = `${this.panel}|${this.tab[this.panel!]}|${this.ctrl.version}|${s.shells}|${s.level}`;
    switch (this.panel) {
      case 'hatchery':
        return `${base}|${s.eggs.map((e) => e.hatchAt <= now).join()}`;
      case 'tank':
        return `${base}|${Math.round(s.water)}|${s.feederPortions}|${s.pending.length}|${s.lights}`;
      case 'journal':
        return `${base}|${s.fish.map((f) => `${Math.round(f.hunger / 5)}${Math.round(f.health / 5)}${Math.round(f.happiness / 5)}`).join()}|${s.log.length}|${Math.floor(now / 60000)}`;
      default:
        return base;
    }
  }

  private refreshPanel(force = false): void {
    if (!this.panelEl || !this.panel || !this.ctrl.loaded) return;
    if (this.pointerDownInPanel && !force) return;
    if (this.panelEl.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement && !force) return;
    const sig = this.signature();
    if (sig === this.panelSig && !force) return;
    this.panelSig = sig;
    const scroll = this.panelBody?.scrollTop ?? 0;
    const name = this.panel;
    const tabs = PANEL_TABS[name];
    const sub =
      name === 'hatchery'
        ? `${this.ctrl.save.eggs.length} egg${this.ctrl.save.eggs.length === 1 ? '' : 's'}`
        : name === 'shop'
          ? `${fmt(this.ctrl.save.shells)} shells`
          : name === 'journal'
            ? `${this.ctrl.save.fish.length} fish`
            : this.ctrl.save.name;
    const head = h(
      'div',
      { class: 'panel-head' },
      h('div', null, h('h2', null, PANEL_TITLES[name]), h('div', { class: 'sub' }, sub)),
      h('button', { class: 'btn ghost icon-btn', title: 'Close (Esc)', onclick: () => this.closePanel() }, icon('close')),
    );
    const tabsEl = tabs.length
      ? h('div', { class: 'tabs' }, ...tabs.map((t) => h('button', { class: `tab${this.tab[name] === t.id ? ' active' : ''}`, onclick: () => this.setTab(name, t.id) }, t.label)))
      : null;
    const content = name === 'shop' ? shopPanel(this) : name === 'hatchery' ? hatcheryPanel(this) : name === 'tank' ? tankPanel(this) : journalPanel(this);
    this.panelBody = h('div', { class: 'panel-body' }, ...content);
    this.panelEl.replaceChildren(head, ...(tabsEl ? [tabsEl] : []), this.panelBody);
    this.panelBody.scrollTop = scroll;
    this.updateTimers(this.panelEl);
  }

  // ------------------------------------------------------------ placement

  place(kind: 'plant' | 'decor', type: string, moveId?: string): void {
    const def = kind === 'plant' ? PLANTS_BY_ID.get(type) : DECOR_BY_ID.get(type);
    if (!def) return;
    if (!moveId && this.ctrl.save.shells < def.cost) return this.toast('Not enough shells.', 'warn');
    this.closePanel();
    this.closeInspector();
    this.scene.beginPlacement({ kind, type, moveId });
    this.placementBar?.remove();
    this.placementBar = h(
      'div',
      { class: 'placement-bar glass' },
      h('span', null, `${moveId ? 'Moving' : 'Placing'} ${def.name} — click the sand`),
      kind === 'decor' ? h('button', { class: 'btn small', onclick: () => this.scene.rotatePlacement() }, icon('rotate'), 'Rotate (R)') : null,
      h('button', { class: 'btn small ghost', onclick: () => this.scene.cancelPlacement() }, 'Cancel (Esc)'),
    );
    this.placementBar.querySelectorAll('svg').forEach((s) => s.setAttribute('style', 'width:14px;height:14px'));
    this.root.append(this.placementBar);
    this.tutorial.position();
  }

  private hidePlacementBar(): void {
    this.placementBar?.remove();
    this.placementBar = null;
    this.tutorial.position();
  }

  // ------------------------------------------------------------ inspector

  private handlePick(p: PickResult | null): void {
    if (!p) return this.closeInspector();
    if (p.kind === 'decor') {
      const d = this.ctrl.save.decor.find((x) => x.id === p.id);
      if (d?.lootAt !== undefined && d.lootAt <= this.ctrl.now()) {
        this.ctrl.openChest(d.id);
        return;
      }
    }
    this.inspecting = p;
    this.inspectorSig = '';
    if (p.kind === 'fish') this.tutorial.notify('pick:fish');
    if (p.kind === 'fish') this.scene.focusFish(p.id);
    else this.scene.focusFish(null);
    this.refreshInspector();
  }

  inspectFish(id: string): void {
    this.closePanel();
    this.handlePick({ kind: 'fish', id });
    this.scene.follow(id);
  }

  closeInspector(): void {
    this.inspectorEl?.remove();
    this.inspectorEl = null;
    this.inspecting = null;
    this.scene.focusFish(null);
  }

  private refreshInspector(): void {
    const p = this.inspecting;
    if (!p || !this.ctrl.loaded) return;
    if (this.inspectorEl?.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) return;
    const s = this.ctrl.save;
    const now = this.ctrl.now();
    let el: HTMLElement | null = null;
    let sig = '';
    if (p.kind === 'fish') {
      const f = s.fish.find((x) => x.id === p.id);
      if (!f) return this.closeInspector();
      const def = SPECIES_BY_ID.get(f.species)!;
      const growth = fishGrowth(f, now);
      const following = this.scene.followId === f.id;
      sig = `${f.id}|${f.name}|${Math.round(f.hunger)}|${Math.round(f.health)}|${Math.round(f.happiness)}|${growth >= 1}|${following}|${this.confirmRehome}`;
      if (sig === this.inspectorSig) return;
      const fullness = 100 - f.hunger;
      const income = growth >= 1 && f.happiness >= 40 ? def.shellsPerHour * (0.5 + f.happiness / 200) : 0;
      const target = targetHappiness(f, s, tankStats(s, now));
      const nameBtn = h('button', { class: 'name', title: 'Rename', onclick: () => rename() }, f.name);
      const rename = () => {
        const input = h('input', { class: 'text', value: f.name, maxlength: '18' }) as HTMLInputElement;
        const commit = () => {
          this.ctrl.rename(f.id, input.value);
          this.inspectorSig = '';
          input.blur();
          this.refreshInspector();
        };
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') (this.inspectorSig = ''), input.blur(), this.refreshInspector();
        });
        input.addEventListener('blur', () => setTimeout(commit, 0), { once: true });
        nameBtn.replaceWith(input);
        input.focus();
        input.select();
      };
      const reward = Math.max(5, Math.round(def.cost * 0.3 * (0.4 + 0.6 * growth)));
      el = h(
        'div',
        { class: 'inspector glass' },
        h(
          'div',
          { class: 'head' },
          fishSwatch(def),
          h('div', { class: 'grow', style: 'flex:1;min-width:0' }, nameBtn, h('div', { class: 'muted', style: 'font-size:12px;font-weight:700' }, `${def.name} · ${def.rarity}`)),
          h('button', { class: 'btn ghost icon-btn', onclick: () => this.closeInspector() }, icon('close')),
        ),
        meter('Fullness', fullness / 100, f.hunger >= 100 ? 'Starving!' : `${Math.round(fullness)}%`, f.hunger >= HUNGRY ? 'bad' : fullness < 50 ? 'warn' : 'good'),
        meter('Health', f.health / 100, `${Math.round(f.health)}%`, f.health < 40 ? 'bad' : f.health < 70 ? 'warn' : 'good'),
        meter('Happiness', f.happiness / 100, `${Math.round(f.happiness)}%`, f.happiness < 40 ? 'warn' : ''),
        h(
          'div',
          { class: 'kv' },
          h('span', null, 'Stage'),
          growth >= 1 ? h('span', null, 'Adult') : h('span', null, 'Growing · ', until(f.bornAt + def.growMs, 'any moment')),
          h('span', null, 'Hatched'),
          h('span', null, formatAgo(now - f.bornAt)),
          h('span', null, 'Makes'),
          h('span', null, income ? `${income.toFixed(1)} shells/hr` : growth < 1 ? 'once grown' : 'needs cheering up'),
          h('span', null, 'Mood heading'),
          h('span', null, target > f.happiness + 2 ? 'up ↑' : target < f.happiness - 2 ? 'down ↓' : 'steady'),
        ),
        h(
          'div',
          { class: 'row' },
          h('button', { class: `btn small${following ? ' primary' : ''}`, onclick: () => (this.scene.follow(following ? null : f.id), (this.inspectorSig = ''), this.refreshInspector()) }, following ? 'Following' : 'Follow'),
          h('span', { class: 'spacer' }),
          this.confirmRehome === f.id
            ? h('button', { class: 'btn small danger confirm', onclick: () => ((this.confirmRehome = null), this.ctrl.rehome(f.id)) }, `Rehome for ${reward}?`)
            : h('button', { class: 'btn small danger', title: 'Send to the Reef Sanctuary to free up space', onclick: () => ((this.confirmRehome = f.id), (this.inspectorSig = ''), this.refreshInspector()) }, 'Rehome'),
        ),
      );
    } else {
      const isPlant = p.kind === 'plant';
      const item = isPlant ? s.plants.find((x) => x.id === p.id) : s.decor.find((x) => x.id === p.id);
      if (!item) return this.closeInspector();
      const def = isPlant ? PLANTS_BY_ID.get(item.type) : DECOR_BY_ID.get(item.type);
      if (!def) return this.closeInspector();
      const prog = isPlant ? plantProgress(item as never, now) : 1;
      const decor = !isPlant ? (item as (typeof s.decor)[number]) : null;
      sig = `${item.id}|${prog >= 1}|${decor?.lootAt}|${this.confirmRemove}`;
      if (sig === this.inspectorSig) return;
      el = h(
        'div',
        { class: 'inspector glass' },
        h(
          'div',
          { class: 'head' },
          h('div', { class: 'grow', style: 'flex:1' }, h('div', { class: 'name', style: 'font-size:18px;font-weight:800' }, def.name), h('div', { class: 'muted', style: 'font-size:12px' }, def.blurb)),
          h('button', { class: 'btn ghost icon-btn', onclick: () => this.closeInspector() }, icon('close')),
        ),
        isPlant
          ? prog >= 1
            ? h('div', { class: 'chip good' }, 'Fully grown — cleaning water & making shells')
            : h('div', null, h('div', { class: 'kv' }, h('span', null, 'Fully grown in'), until((item as { plantedAt: number }).plantedAt + (def as { growMs: number }).growMs)), h('div', { style: 'margin-top:6px' }, timedBar((item as { plantedAt: number }).plantedAt, (item as { plantedAt: number }).plantedAt + (def as { growMs: number }).growMs)))
          : null,
        decor?.lootAt !== undefined ? h('div', { class: 'kv' }, h('span', null, 'Next loot'), until(decor.lootAt, 'Ready — tap the chest!')) : null,
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn small', onclick: () => this.place(isPlant ? 'plant' : 'decor', item.type, item.id) }, 'Move'),
          h('span', { class: 'spacer' }),
          this.confirmRemove === item.id
            ? h('button', { class: 'btn small danger confirm', onclick: () => ((this.confirmRemove = null), this.ctrl.remove(item.id), this.closeInspector()) }, `Remove (+${Math.floor(def.cost * 0.4)})`)
            : h('button', { class: 'btn small danger', onclick: () => ((this.confirmRemove = item.id), (this.inspectorSig = ''), this.refreshInspector()) }, 'Remove'),
        ),
      );
    }
    this.inspectorSig = sig;
    if (this.inspectorEl) this.inspectorEl.replaceWith(el);
    else this.root.append(el);
    this.inspectorEl = el;
    this.updateTimers(el);
  }
  private confirmRehome: string | null = null;
  private confirmRemove: string | null = null;

  // ------------------------------------------------------------ feedback

  toast(text: string, tone: 'good' | 'bad' | 'info' | 'warn' = 'info'): void {
    const t = h('div', { class: `toast ${tone}` }, text);
    this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, tone === 'bad' ? 5200 : 3400);
  }

  private handleEvents(events: SimEvent[], away: boolean): void {
    for (const e of events) if (e.kind === 'fishDied' && e.refId) this.scene.markDying(e.refId);
    const lastLevel = [...events].reverse().find((e) => e.kind === 'levelUp');
    if (lastLevel) this.celebrate(lastLevel.text);
    const shown = events.filter((e) => e.kind !== 'levelUp' && e.kind !== 'autoFeed');
    // Lots happening at once (offline catch-up, a time warp) reads better as a summary.
    if (away || shown.length > 4) return this.awaySummary(events);
    for (const e of shown) this.toast(e.text, e.tone);
  }

  private handleAction(name: string, data: unknown): void {
    this.tutorial.notify(`action:${name}`);
    switch (name) {
      case 'feed':
        this.scene.dropFood();
        break;
      case 'clean':
        this.scene.cleanEffect();
        break;
      case 'collect':
        this.scene.collectEffect();
        break;
      case 'hatch': {
        const fish = (data as { fish?: { id: string } }).fish;
        if (fish) {
          this.scene.markHatched(fish.id);
          setTimeout(() => this.handlePick({ kind: 'fish', id: fish.id }), 400);
        }
        break;
      }
      case 'rehome':
        this.scene.markLeaving((data as { id: string }).id);
        this.closeInspector();
        break;
      case 'chest':
        this.scene.burstAtItem((data as { id: string }).id);
        break;
    }
  }

  private celebrate(text: string): void {
    const [head, ...rest] = text.split(' · ');
    const el = h('div', { class: 'levelup' }, h('div', { class: 'big' }, head.split('!')[0] + '!'), h('div', { class: 'small' }, [head.split('!')[1], ...rest].filter(Boolean).join(' · ')));
    this.root.append(el);
    setTimeout(() => el.remove(), 3300);
  }

  private awaySummary(events: SimEvent[]): void {
    const s = this.ctrl.save;
    const lost = events.filter((e) => e.kind === 'fishDied');
    const important = events.filter((e) => !['autoFeed', 'hungry'].includes(e.kind));
    const seen = new Set<string>();
    const lines = important.filter((e) => (seen.has(e.text) ? false : (seen.add(e.text), true))).slice(-14);
    const pend = Math.floor(s.pendingShells);
    this.modal(lost.length ? 'While you were away…' : 'Welcome back!', [
      lost.length
        ? h('p', { style: 'margin:0;color:var(--bad);font-weight:700' }, `${lost.length} fish didn't make it. Remember to feed your tank at least once a day.`)
        : h('p', { class: 'muted', style: 'margin:0' }, 'Here is what happened in your tank.'),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, ...lines.map((e) => h('div', { class: `log-item ${e.tone}` }, h('span', null, e.text)))),
      pend >= 1 ? h('div', { class: 'card' }, shellIcon(), h('div', { class: 'grow' }, h('h3', null, `${fmt(pend)} shells waiting`), h('p', null, 'Your fish made these while you were gone.')), h('button', { class: 'btn small primary', onclick: () => this.ctrl.collect() }, 'Collect')) : null,
    ]);
  }

  modal(title: string, body: (HTMLElement | null)[]): void {
    const overlay = h('div', { class: 'overlay' });
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => e.target === overlay && close());
    overlay.append(h('div', { class: 'modal glass' }, h('h2', null, title), ...body, h('button', { class: 'btn primary', style: 'align-self:flex-end', onclick: close }, 'Back to the tank')));
    this.root.append(overlay);
  }

  // ------------------------------------------------------------ menus

  private toggleMenu(anchor: HTMLElement): void {
    if (this.menu) return this.closeMenu();
    this.ctrl.flush();
    this.menu = slotMenu(
      this.ctrl,
      (slot, name) => this.openSlot(slot, name),
      () => {
        this.ctrl.close();
        this.showTitle();
      },
    );
    const settings = h(
      'div',
      { style: 'display:flex;gap:6px;padding:6px 4px 2px;flex-wrap:wrap' },
      h('button', { class: 'btn small', onclick: () => (this.scene.resetCamera(), this.closeMenu()) }, 'Reset camera'),
      h('button', { class: 'btn small', onclick: () => (this.closeMenu(), this.closePanel(), this.tutorial.restart()) }, 'Replay tutorial'),
      h(
        'button',
        {
          class: 'btn small',
          onclick: () => {
            const q = this.scene.quality === 'high' ? 'low' : 'high';
            this.scene.setQuality(q);
            safeSet(QUALITY_KEY, q);
            this.toast(`Graphics: ${q === 'high' ? 'High (glow effects on)' : 'Low (faster)'}`);
            this.closeMenu();
          },
        },
        `Graphics: ${this.scene.quality === 'high' ? 'High' : 'Low'}`,
      ),
    );
    this.menu.append(settings);
    anchor.parentElement!.append(this.menu);
    this.menu.querySelectorAll('svg').forEach((s) => s.setAttribute('style', 'width:16px;height:16px'));
    setTimeout(() => window.addEventListener('click', this.outsideMenu), 0);
  }
  private outsideMenu = (e: MouseEvent) => {
    if (this.menu && !this.menu.contains(e.target as Node)) this.closeMenu();
  };
  private closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
    window.removeEventListener('click', this.outsideMenu);
  }

  private photoMode(): void {
    if (!this.ctrl.loaded) return;
    this.closePanel();
    this.closeInspector();
    document.body.classList.add('photo');
    const exit = () => {
      document.body.classList.remove('photo');
      bar.remove();
      window.removeEventListener('keydown', onKey);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && exit();
    window.addEventListener('keydown', onKey);
    const bar = h(
      'div',
      { class: 'photo-bar glass' },
      h(
        'button',
        {
          class: 'btn primary',
          onclick: () => {
            const url = this.scene.capture();
            const a = h('a', { href: url, download: `${this.ctrl.save.name.replace(/[^\w-]+/g, '_')}-aquarium.png` });
            a.click();
          },
        },
        icon('download'),
        'Save photo',
      ),
      h('button', { class: 'btn', onclick: exit }, 'Done'),
    );
    bar.querySelectorAll('svg').forEach((s) => s.setAttribute('style', 'width:16px;height:16px'));
    this.root.append(bar);
  }

  // ------------------------------------------------------------ keys

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '`' || e.key === '~') {
        if (!typing || this.console.isOpen) {
          e.preventDefault();
          this.console.toggle();
        }
        return;
      }
      if (typing || !this.ctrl.loaded || this.title || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (this.scene.placing) this.scene.cancelPlacement();
        else if (this.panel) this.closePanel();
        else if (this.inspecting) this.closeInspector();
        else this.scene.follow(null);
        return;
      }
      if (this.scene.placing) {
        if (k === 'r') this.scene.rotatePlacement();
        return;
      }
      const map: Record<string, () => void> = {
        f: () => this.ctrl.feed(),
        c: () => this.ctrl.clean(),
        g: () => this.ctrl.collect(),
        h: () => this.togglePanel('hatchery'),
        s: () => this.togglePanel('shop'),
        t: () => this.togglePanel('tank'),
        j: () => this.togglePanel('journal'),
        p: () => this.photoMode(),
      };
      map[k]?.();
    });
  }
}

function meter(label: string, pct: number, text: string, tone: string): HTMLElement {
  return h('div', { class: 'meter' }, h('span', null, label), bar(pct, tone), h('span', null, text));
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

export { costBtn };

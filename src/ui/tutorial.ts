import type { AquariumController } from '../app/controller';
import { TUTORIAL_REWARD } from '../core/actions';
import { STARTER_EGG_MS } from '../core/catalog';
import { TUTORIAL_DONE } from '../core/state';
import { formatDuration } from '../core/time';
import { h } from './dom';
import { glassIcon } from './glass';

/**
 * Things the tutorial can wait for. The UI reports them via `notify()`:
 *   action:<name>  — a controller action succeeded (feed, buyPlant, …)
 *   pick:fish      — the player clicked a fish
 *   panel:<name>   — a panel was opened
 */
export type TutorialSignal = string;

export interface TutorialStep {
  id: string;
  title: string | ((ctrl: AquariumController) => string);
  body: string | ((ctrl: AquariumController) => string);
  /** `data-tut` value of the element to highlight. Omit for a centred card. */
  target?: string;
  /** Advance automatically when this signal arrives. */
  waitFor?: TutorialSignal;
  /** Short call to action shown while waiting. */
  hint?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: (c) => `Welcome to ${c.save.name}!`,
    body: 'Three neon tetras just moved in. This quick tour covers the basics. It takes about a minute, and you can skip it at any time.',
  },
  {
    id: 'camera',
    title: 'Look around',
    body: 'Drag to orbit the tank, scroll (or pinch) to zoom, and double-click to reset the view.',
  },
  {
    id: 'fish',
    title: 'Meet your fish',
    body: 'Click any fish to see its fullness, health and mood. You can rename it there, too.',
    waitFor: 'pick:fish',
    hint: 'Click a fish in the tank',
  },
  {
    id: 'feed',
    title: 'Feeding time',
    body: 'Your tetras are peckish. Fish get hungrier every hour, and a fish left unfed for about a day can die. Feed them at least once a day.',
    target: 'feed',
    waitFor: 'action:feed',
    hint: 'Press Feed (or F)',
  },
  {
    id: 'hatchery',
    title: 'The hatchery',
    body: `A guppy egg is already incubating and hatches about ${formatDuration(STARTER_EGG_MS)} after you create the tank. Eggs take real time to hatch: a few minutes for this one, many hours for rare fish.`,
    target: 'hatchery',
    waitFor: 'panel:hatchery',
    hint: 'Open the Hatchery (or H)',
  },
  {
    id: 'shop',
    title: 'Plant something',
    body: 'Open the Shop, switch to Plants and buy a Java Fern, then click the sand to place it. Plants clean the water and cheer your fish up.',
    target: 'shop',
    waitFor: 'action:buyPlant',
    hint: 'Buy a plant and place it',
  },
  {
    id: 'water',
    title: 'Keep the water clean',
    body: 'Water gets dirtier over time. Watch this meter and press Clean when it turns murky. Feeding fish that are not hungry dirties it faster.',
    target: 'water',
  },
  {
    id: 'shells',
    title: 'Shells',
    body: 'Grown, happy fish slowly make shells, the currency for eggs, plants and decor. Collect them from the dock. The pile has a limit, so check in often.',
    target: 'collect',
  },
  {
    id: 'level',
    title: 'Level up',
    body: 'Feeding hungry fish, cleaning, hatching and collecting all earn XP. Each level unlocks new fish, plants, decorations and upgrades.',
    target: 'level',
  },
  {
    id: 'done',
    title: "You're all set!",
    body: 'Come back at least once a day to feed your fish. You can keep up to five tanks and switch between them from this menu.',
    target: 'slots',
  },
];

/** Step-by-step guided tour shown on every new tank (and resumable after a reload). */
export class Tutorial {
  private card: HTMLElement | null = null;
  private ring: HTMLElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onResize = () => this.position();

  constructor(
    private root: HTMLElement,
    private ctrl: AquariumController,
    readonly steps: TutorialStep[] = TUTORIAL_STEPS,
  ) {}

  get active(): boolean {
    return !!this.card;
  }

  get stepIndex(): number {
    return this.ctrl.loaded ? this.ctrl.save.tutorial : TUTORIAL_DONE;
  }

  get step(): TutorialStep | null {
    const i = this.stepIndex;
    return i >= 0 && i < this.steps.length ? this.steps[i] : null;
  }

  /** Show the tutorial if this tank still has one in progress. */
  resume(): void {
    if (!this.ctrl.loaded || this.stepIndex === TUTORIAL_DONE) return this.hide();
    if (this.stepIndex >= this.steps.length) this.ctrl.tutorialStep(this.steps.length - 1);
    this.render();
  }

  restart(): void {
    this.ctrl.restartTutorial();
    this.render();
  }

  notify(signal: TutorialSignal): void {
    const step = this.step;
    if (!this.active || !step?.waitFor || step.waitFor !== signal) return;
    // Let the action's own feedback (toast, effects) land before moving on.
    setTimeout(() => this.next(), 450);
  }

  next(): void {
    const i = this.stepIndex;
    if (i < 0) return this.hide();
    if (i >= this.steps.length - 1) return this.finish();
    this.ctrl.tutorialStep(i + 1);
    this.render();
  }

  back(): void {
    const i = this.stepIndex;
    if (i <= 0) return;
    this.ctrl.tutorialStep(i - 1);
    this.render();
  }

  skip(): void {
    this.ctrl.endTutorial(false);
    this.hide();
  }

  finish(): void {
    this.ctrl.endTutorial(true);
    this.hide();
  }

  hide(): void {
    this.card?.remove();
    this.ring?.remove();
    this.card = null;
    this.ring = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('resize', this.onResize);
  }

  private render(): void {
    const step = this.step;
    if (!step) return this.hide();
    const i = this.stepIndex;
    const total = this.steps.length;
    const resolve = (v: string | ((c: AquariumController) => string)) => (typeof v === 'function' ? v(this.ctrl) : v);
    const last = i === total - 1;

    const dots = h('div', { class: 'tut-dots' }, ...this.steps.map((_, k) => h('i', { class: k === i ? 'on' : k < i ? 'done' : '' })));
    const actions = h('div', { class: 'tut-actions' });
    actions.append(h('button', { class: 'btn ghost small tut-skip', onclick: () => this.skip() }, 'Skip tutorial'), h('span', { class: 'spacer' }));
    if (i > 0) actions.append(h('button', { class: 'btn small', onclick: () => this.back() }, 'Back'));
    if (step.waitFor) actions.append(h('button', { class: 'btn small ghost', title: 'Skip just this step', onclick: () => this.next() }, 'Skip step'));
    else
      actions.append(
        h('button', { class: 'btn small primary tut-next', onclick: () => this.next() }, last ? `Finish (+${TUTORIAL_REWARD} shells)` : i === 0 ? "Let's go" : 'Next'),
      );

    const card = h(
      'div',
      { class: 'tut-card glass', role: 'dialog', 'aria-live': 'polite', 'data-step': step.id },
      h('div', { class: 'tut-top' }, glassIcon('guide', 26), h('span', { class: 'tut-count' }, `Tutorial · ${i + 1} of ${total}`), dots),
      h('h3', null, resolve(step.title)),
      h('p', null, resolve(step.body)),
      step.hint ? h('div', { class: 'tut-hint' }, h('span', { class: 'tut-pulse' }), step.hint) : null,
      actions,
    );
    if (this.card) this.card.replaceWith(card);
    else this.root.append(card);
    this.card = card;

    if (!this.ring) {
      this.ring = h('div', { class: 'tut-ring' });
      this.root.append(this.ring);
    }
    if (!this.timer) {
      // Targets (dock, HUD) can shift as panels open; keep the highlight glued on.
      this.timer = setInterval(() => this.position(), 250);
      window.addEventListener('resize', this.onResize);
    }
    this.position();
  }

  private target(): HTMLElement | null {
    const id = this.step?.target;
    if (!id) return null;
    const el = this.root.querySelector<HTMLElement>(`[data-tut="${id}"]`);
    return el && el.getClientRects().length > 0 ? el : null;
  }

  position(): void {
    const card = this.card;
    const ring = this.ring;
    if (!card || !ring) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth || 340;
    const ch = card.offsetHeight || 200;
    const margin = 12;
    const target = this.target();
    const placing = !!this.root.querySelector('.placement-bar');

    if (!target) {
      ring.style.display = 'none';
      // Centred, but nudged up so it doesn't hide the tank's middle.
      card.style.left = `${Math.round((vw - cw) / 2)}px`;
      card.style.top = placing ? '84px' : `${Math.round(Math.max(margin, vh * 0.16))}px`;
      return;
    }
    const r = target.getBoundingClientRect();
    ring.style.display = 'block';
    ring.style.left = `${r.left - 6}px`;
    ring.style.top = `${r.top - 6}px`;
    ring.style.width = `${r.width + 12}px`;
    ring.style.height = `${r.height + 12}px`;

    let left = r.left + r.width / 2 - cw / 2;
    left = Math.min(vw - cw - margin, Math.max(margin, left));
    let top: number;
    if (placing) top = 84;
    else if (r.top > vh / 2) top = r.top - ch - 18; // target near the bottom (dock): card above it
    else top = r.bottom + 18; // target near the top (HUD): card below it
    top = Math.min(vh - ch - margin, Math.max(margin, top));
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }
}

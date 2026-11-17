import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AquariumController } from '../src/app/controller';
import { TUTORIAL_REWARD } from '../src/core/actions';
import { TUTORIAL_DONE } from '../src/core/state';
import { CookieSaveBackend } from '../src/storage/saves';
import { Tutorial, TUTORIAL_STEPS } from '../src/ui/tutorial';

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

let root: HTMLElement;
let ctrl: AquariumController;

beforeEach(() => {
  clearCookies();
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.append(root);
  ctrl = new AquariumController(new CookieSaveBackend());
  vi.useFakeTimers();
});

afterEach(() => {
  ctrl.close();
  vi.useRealTimers();
});

const card = () => root.querySelector<HTMLElement>('.tut-card');
const button = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('.tut-card button')].find((b) => b.textContent?.includes(text));

describe('tutorial', () => {
  it('shows on a brand new tank, starting with a welcome', () => {
    ctrl.createSlot(1, 'Kelp Corner');
    const t = new Tutorial(root, ctrl);
    t.resume();
    expect(t.active).toBe(true);
    expect(card()!.dataset.step).toBe('welcome');
    expect(card()!.textContent).toContain('Welcome to Kelp Corner!');
    expect(button('Skip tutorial')).toBeTruthy();
    expect(card()!.textContent).toContain(`1 of ${TUTORIAL_STEPS.length}`);
  });

  it('does not show for tanks that already finished it', () => {
    ctrl.createSlot(1, 'Old Tank');
    ctrl.endTutorial(false);
    const t = new Tutorial(root, ctrl);
    t.resume();
    expect(t.active).toBe(false);
    expect(card()).toBeNull();
  });

  it('waits for the right action before advancing', () => {
    ctrl.createSlot(1, 'Tank');
    const t = new Tutorial(root, ctrl);
    t.resume();
    button("Let's go")!.click();
    button('Next')!.click();
    expect(card()!.dataset.step).toBe('fish');
    expect(button('Next')).toBeUndefined(); // interactive step: no plain Next
    t.notify('action:feed'); // wrong signal
    vi.advanceTimersByTime(1000);
    expect(card()!.dataset.step).toBe('fish');
    t.notify('pick:fish');
    vi.advanceTimersByTime(1000);
    expect(card()!.dataset.step).toBe('feed');
    // The real feed action, as the UI would report it
    ctrl.feed();
    t.notify('action:feed');
    vi.advanceTimersByTime(1000);
    expect(card()!.dataset.step).toBe('hatchery');
    button('Skip step')!.click();
    expect(card()!.dataset.step).toBe('shop');
    button('Back')!.click();
    expect(card()!.dataset.step).toBe('hatchery');
  });

  it('skip ends it for good with no reward', () => {
    ctrl.createSlot(1, 'Tank');
    const shells = ctrl.save.shells;
    const t = new Tutorial(root, ctrl);
    t.resume();
    button('Skip tutorial')!.click();
    expect(card()).toBeNull();
    expect(root.querySelector('.tut-ring')).toBeNull();
    expect(ctrl.save.tutorial).toBe(TUTORIAL_DONE);
    expect(ctrl.save.shells).toBe(shells);
  });

  it('finishing pays a reward once', () => {
    ctrl.createSlot(1, 'Tank');
    const shells = ctrl.save.shells;
    const t = new Tutorial(root, ctrl);
    t.resume();
    for (let i = 0; i < TUTORIAL_STEPS.length - 1; i++) t.next();
    expect(card()!.dataset.step).toBe('done');
    button('Finish')!.click();
    expect(card()).toBeNull();
    expect(ctrl.save.shells).toBe(shells + TUTORIAL_REWARD);
    t.resume();
    expect(card()).toBeNull();
  });

  it('resumes from the saved step after a reload, and can be replayed', () => {
    ctrl.createSlot(2, 'Tank');
    const t = new Tutorial(root, ctrl);
    t.resume();
    t.next();
    t.next();
    t.next();
    expect(card()!.dataset.step).toBe('feed');
    t.hide();
    ctrl.close();

    const ctrl2 = new AquariumController(new CookieSaveBackend());
    ctrl2.open(2);
    const t2 = new Tutorial(root, ctrl2);
    t2.resume();
    expect(card()!.dataset.step).toBe('feed');
    t2.skip();
    t2.restart();
    expect(card()!.dataset.step).toBe('welcome');
    ctrl2.close();
  });

  it('every new tank gets its own tutorial', () => {
    ctrl.createSlot(1, 'First');
    ctrl.endTutorial(false);
    ctrl.createSlot(3, 'Second');
    const t = new Tutorial(root, ctrl);
    t.resume();
    expect(card()!.textContent).toContain('Welcome to Second!');
  });
});

import type { AquariumController } from '../app/controller';
import { SLOT_COUNT, type SlotSummary } from '../core/state';
import { formatAgo } from '../core/time';
import { h } from './dom';
import { icon } from './icons';

type SlotEntry = ReturnType<AquariumController['backend']['list']>[number];
const isFilled = (s: SlotEntry): s is SlotSummary => 'name' in s;

const LOGO = `${import.meta.env.BASE_URL}retrac-space-logo.png`;

/** Full-screen tank picker with five save slots. */
export function titleScreen(ctrl: AquariumController, onOpen: (slot: number, newName?: string) => void): HTMLElement {
  const screen = h('div', { class: 'title-screen' });
  for (let i = 0; i < 14; i++) {
    const size = 6 + Math.random() * 22;
    screen.append(
      h('span', {
        class: 'bubble',
        style: `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${9 + Math.random() * 14}s;animation-delay:-${Math.random() * 20}s`,
      }),
    );
  }
  screen.append(
    h(
      'div',
      { class: 'hero' },
      h('img', { class: 'logo', src: LOGO, alt: 'retrac.space' }),
      h('h1', null, 'Digital ', h('span', null, 'Aquarium')),
      h('p', null, 'A tiny living world. Hatch it, grow it, keep it fed.'),
    ),
  );
  const list = h('div', { class: 'slots' });
  screen.append(list, h('div', { class: 'title-foot' }, 'Saved in this browser (cookies) · five tanks · cloud saves coming soon.'));

  const render = () => {
    list.replaceChildren();
    const slots = ctrl.backend.list();
    const last = ctrl.backend.getActiveSlot();
    for (const s of slots) list.append(slotRow(s, s.slot === last));
  };

  const slotRow = (s: SlotEntry, isLast: boolean): HTMLElement => {
    if (isFilled(s)) {
      let confirmDel = false;
      const del = h('button', {
        class: 'btn small danger',
        title: 'Delete this tank',
        onclick: (e: Event) => {
          e.stopPropagation();
          if (!confirmDel) {
            confirmDel = true;
            del.textContent = 'Really delete?';
            del.classList.add('confirm');
            setTimeout(() => {
              confirmDel = false;
              del.textContent = 'Delete';
              del.classList.remove('confirm');
            }, 3000);
            return;
          }
          ctrl.deleteSlot(s.slot);
          render();
        },
      }, 'Delete');
      return h(
        'div',
        { class: `slot filled${isLast ? ' last' : ''}`, onclick: () => onOpen(s.slot) },
        h('div', { class: 'num' }, String(s.slot)),
        h(
          'div',
          { class: 'info' },
          h('b', null, s.name),
          h(
            'small',
            null,
            h('span', null, `Level ${s.level}`),
            h('span', null, `${s.fish} fish`),
            h('span', null, `Visited ${formatAgo(Date.now() - s.updatedAt)}`),
            s.hungry ? h('span', { style: 'color:var(--warn)' }, `${s.hungry} hungry when you left`) : null,
          ),
        ),
        h('div', { class: 'acts' }, del, h('button', { class: 'btn primary', onclick: (e: Event) => (e.stopPropagation(), onOpen(s.slot)) }, isLast ? 'Continue' : 'Open')),
      );
    }
    if ('corrupt' in s) {
      return h(
        'div',
        { class: 'slot' },
        h('div', { class: 'num' }, String(s.slot)),
        h('div', { class: 'info' }, h('b', null, 'Unreadable save'), h('small', null, 'This slot looks damaged.')),
        h('div', { class: 'acts' }, h('button', { class: 'btn small danger', onclick: () => (ctrl.deleteSlot(s.slot), render()) }, 'Clear slot')),
      );
    }
    // empty slot → inline create
    const input = h('input', { class: 'text', placeholder: `Name your tank (e.g. Reef ${s.slot})`, maxlength: '24' }) as HTMLInputElement;
    const create = () => onOpen(s.slot, input.value.trim() || `Tank ${s.slot}`);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && create());
    const row = h(
      'div',
      { class: 'slot' },
      h('div', { class: 'num' }, String(s.slot)),
      h('div', { class: 'info' }, h('b', { class: 'muted' }, 'Empty slot'), h('small', null, 'Start a fresh aquarium')),
      h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => showCreate() }, '+ New tank')),
    );
    const showCreate = () => {
      row.replaceChildren(
        h('div', { class: 'num' }, String(s.slot)),
        h('div', { class: 'info' }, input),
        h('div', { class: 'acts' }, h('button', { class: 'btn ghost small', onclick: render }, 'Cancel'), h('button', { class: 'btn primary', onclick: create }, 'Create')),
      );
      input.focus();
    };
    return row;
  };

  render();
  return screen;
}

/** Dropdown under the tank name for quick slot switching. */
export function slotMenu(ctrl: AquariumController, onOpen: (slot: number, newName?: string) => void, onManage: () => void): HTMLElement {
  const menu = h('div', { class: 'slot-menu glass' });
  const slots = ctrl.backend.list();
  for (let i = 0; i < SLOT_COUNT; i++) {
    const s = slots[i];
    const current = s.slot === ctrl.slot;
    if (isFilled(s)) {
      menu.append(
        h(
          'button',
          { class: `item${current ? ' current' : ''}`, onclick: () => !current && onOpen(s.slot) },
          h('span', { class: 'n' }, String(s.slot)),
          h('span', null, current ? ctrl.save.name : s.name, h('span', { class: 'sub' }, current ? 'Current tank' : `Lv ${s.level} · ${s.fish} fish · ${formatAgo(Date.now() - s.updatedAt)}`)),
        ),
      );
    } else if ('empty' in s) {
      menu.append(
        h(
          'button',
          { class: 'item', onclick: () => onOpen(s.slot, `Tank ${s.slot}`) },
          h('span', { class: 'n' }, String(s.slot)),
          h('span', { class: 'muted' }, '+ New tank', h('span', { class: 'sub' }, 'Empty slot')),
        ),
      );
    }
  }
  menu.append(h('hr'), h('button', { class: 'item', onclick: onManage }, icon('settings'), 'Manage all tanks'));
  return menu;
}

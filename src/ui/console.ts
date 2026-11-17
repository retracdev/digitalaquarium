import type { AquariumController } from '../app/controller';
import { h } from './dom';

/**
 * The secret keeper's console (press ` to toggle). It's for testing the long
 * waits — `skip`, `warp 2h`, `shells 500` and friends. Type `help`.
 */
export class DevConsole {
  private el: HTMLElement | null = null;
  private out!: HTMLElement;
  private input!: HTMLInputElement;
  private history: string[] = [];
  private hIndex = -1;

  constructor(
    private root: HTMLElement,
    private ctrl: AquariumController,
  ) {}

  get isOpen(): boolean {
    return !!this.el;
  }

  toggle(): void {
    if (this.el) return this.closeConsole();
    this.out = h('div', { class: 'out' });
    this.input = h('input', { spellcheck: false, autocomplete: 'off', placeholder: 'help' }) as HTMLInputElement;
    this.el = h('div', { class: 'devconsole' }, this.out, h('div', { class: 'in' }, '›', this.input));
    this.print('Keeper console. Type "help". Press ` to close.');
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = this.input.value;
        this.input.value = '';
        if (cmd.trim()) this.history.unshift(cmd);
        this.hIndex = -1;
        this.run(cmd);
      } else if (e.key === 'ArrowUp') {
        this.hIndex = Math.min(this.history.length - 1, this.hIndex + 1);
        this.input.value = this.history[this.hIndex] ?? '';
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        this.hIndex = Math.max(-1, this.hIndex - 1);
        this.input.value = this.history[this.hIndex] ?? '';
      } else if (e.key === 'Escape') this.closeConsole();
    });
    this.root.append(this.el);
    setTimeout(() => this.input.focus(), 0);
  }

  private closeConsole(): void {
    this.el?.remove();
    this.el = null;
  }

  private print(text: string, cls = ''): void {
    this.out.append(h('div', { class: cls }, text));
    this.out.scrollTop = this.out.scrollHeight;
  }

  run(cmd: string): void {
    this.print(`› ${cmd}`, 'cmd');
    const res = this.ctrl.command(cmd);
    for (const line of res.lines) this.print(line);
  }
}

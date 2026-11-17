import { svg } from './dom';

const wrap = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const PATHS = {
  feed: '<path d="M7 4h10l-1 3H8z"/><path d="M8 7l-1 13h10L16 7"/><circle cx="11" cy="12" r=".6" fill="currentColor"/><circle cx="13.5" cy="15" r=".6" fill="currentColor"/><circle cx="10.5" cy="16.5" r=".6" fill="currentColor"/>',
  clean: '<path d="M4 20l6-6"/><rect x="9" y="5" width="9" height="7" rx="2" transform="rotate(45 13.5 8.5)"/><path d="M18 15l.8 1.7L20.5 17.5 18.8 18.3 18 20l-.8-1.7L15.5 17.5l1.7-.8z"/>',
  collect: '<path d="M12 20c-4.5 0-8-3.4-8-8 0-2 1-3.6 2-4.6L12 4l6 3.4c1 1 2 2.6 2 4.6 0 4.6-3.5 8-8 8z"/><path d="M12 20V8M8.5 19l1.5-10M15.5 19l-1.5-10"/>',
  hatchery: '<path d="M12 3c3.8 0 6.5 6 6.5 10a6.5 6.5 0 01-13 0C5.5 9 8.2 3 12 3z"/><path d="M8 12l2 1.5L12 11l2 2.5 2-1.5"/>',
  shop: '<path d="M5 8h14l-1.2 11.2a1 1 0 01-1 .8H7.2a1 1 0 01-1-.8z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  tank: '<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M3 14c2.5-1.5 4.5-1.5 7 0s4.5 1.5 7 0 3-1 4-.5"/><path d="M8 21h8"/>',
  journal: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/><path d="M9 8h6"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  drop: '<path d="M12 3s6 6.4 6 11a6 6 0 01-12 0c0-4.6 6-11 6-11z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
  follow: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  rotate: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
};

export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGElement {
  return svg(wrap(PATHS[name]));
}

export function shellIcon(): SVGElement {
  return svg(
    `<svg class="shell-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c-5 0-9-3.8-9-9 0-2.3 1.1-4.1 2.3-5.2L12 3l6.7 3.8C19.9 7.9 21 9.7 21 12c0 5.2-4 9-9 9z" fill="#ffd9a8"/><path d="M12 21V7M8 20L9.6 8M16 20l-1.6-12M5 17.5l2.6-9M19 17.5l-2.6-9" stroke="#c98f55" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
  );
}

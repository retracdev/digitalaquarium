import { svg } from './dom';

/**
 * "Liquid glass" app-style icons: a coloured tile, a frosted white glass glyph
 * and a coloured glass accent one layer above it. Flat silhouettes only; depth
 * comes from translucency, thin rims and soft shadows that fall outside the
 * shape casting them. Same recipe as public/favicon.svg.
 */

interface Palette {
  /** tile gradient, top to bottom */
  light: string;
  mid: string;
  deep: string;
  /** shadow colour */
  dark: string;
  /** tint at the bottom of the white glass */
  pale: string;
  /** accent glass gradient, top to bottom */
  a1: string;
  a2: string;
}

const PALETTES = {
  violet: { light: '#D9C8FF', mid: '#9C7BF2', deep: '#5B36C8', dark: '#2E1675', pale: '#E4D9FF', a1: '#A47CFF', a2: '#5A2AD0' },
  amber: { light: '#FFE08A', mid: '#FFB636', deep: '#F07A16', dark: '#7A3A06', pale: '#FFEBC9', a1: '#F9731A', a2: '#C2410C' },
  aqua: { light: '#A5F3EC', mid: '#3FD3C6', deep: '#0E9AA0', dark: '#064E55', pale: '#D5FAF6', a1: '#17B8B0', a2: '#0B6F7C' },
  coral: { light: '#FFD3B8', mid: '#FF9A6B', deep: '#EB5B3C', dark: '#7A2410', pale: '#FFE6D8', a1: '#FF6B3D', a2: '#C2361A' },
  pink: { light: '#FFC4DD', mid: '#FF7FB0', deep: '#E0407F', dark: '#7A1240', pale: '#FFE0EC', a1: '#F0428A', a2: '#B81560' },
  blue: { light: '#A9D4FF', mid: '#4C9BFF', deep: '#1F5FE0', dark: '#0E2E7A', pale: '#D8E9FF', a1: '#3B82F6', a2: '#1D3FBF' },
  green: { light: '#C2F5A6', mid: '#6FD85A', deep: '#2E9E48', dark: '#0F4F22', pale: '#DDF8D0', a1: '#3CC24A', a2: '#14803A' },
  slate: { light: '#D5DBE8', mid: '#8E9AB5', deep: '#4E5A78', dark: '#1E2538', pale: '#E3E8F2', a1: '#6B7CA6', a2: '#333F5E' },
  sun: { light: '#FFF0A0', mid: '#FFD23A', deep: '#F5A300', dark: '#7A4A00', pale: '#FFF4CC', a1: '#FFA51F', a2: '#D96A00' },
  rose: { light: '#FFC2C7', mid: '#FF7A85', deep: '#D93A52', dark: '#6E0F22', pale: '#FFE1E4', a1: '#F04860', a2: '#B01536' },
} satisfies Record<string, Palette>;

export type GlassPalette = keyof typeof PALETTES;

const n = (v: number) => +v.toFixed(2);
/** Clockwise circle as a path, so glyphs can be single paths (clip-path friendly). */
const circ = (cx: number, cy: number, r: number) => `M${n(cx - r)} ${cy}a${r} ${r} 0 1 1 ${n(2 * r)} 0a${r} ${r} 0 1 1 ${n(-2 * r)} 0Z`;
/** Clockwise rounded rectangle. */
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${n(x + r)} ${y}H${n(x + w - r)}A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${r} ${r} 0 0 1 ${x} ${n(y + h - r)}V${n(y + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${y}Z`;

interface Glyph {
  palette: GlassPalette;
  /** White glass silhouette (one path; sub-paths wind clockwise). */
  main: string;
  /** Coloured glass accent, one layer above. */
  accent: string;
  /** Faint engraved lines on the main glyph. */
  lines?: string;
  /** Faint engraved filled details on the main glyph. */
  dots?: string;
}

const SPARKLE = (cx: number, cy: number, r: number, w = r * 0.27) =>
  `M${cx} ${n(cy - r)}L${n(cx + w)} ${n(cy - w)}L${n(cx + r)} ${cy}L${n(cx + w)} ${n(cy + w)}L${cx} ${n(cy + r)}L${n(cx - w)} ${n(cy + w)}L${n(cx - r)} ${cy}L${n(cx - w)} ${n(cy - w)}Z`;

const GLYPHS = {
  /** The app icon: a fish with bubbles. */
  fish: {
    palette: 'violet',
    main: 'M50 39C50 31.5 43.5 26.5 36 26.5C33.5 26.5 32 23.2 28.6 23.2C25.6 23.2 25 26 26.6 28.2C24.5 30 23 32.5 22.5 34.5C19.5 31 15.5 28.5 12.5 28.8C10.3 29 9.6 31 10.4 33C11 34.8 12.4 36.8 13.5 39C12.4 41.2 11 43.2 10.4 45C9.6 47 10.3 49 12.5 49.2C15.5 49.5 19.5 47 22.5 43.5C25 48.5 30 51.5 36 51.5C43.5 51.5 50 46.5 50 39Z',
    accent: circ(50.5, 28, 5) + circ(54.5, 16.5, 3.3) + circ(47, 11, 2.2),
    lines: 'M31 33c2.2 3.6 2.2 8.4 0 12',
    dots: circ(43, 37, 2.2),
  },
  /** Food jar with pellets. */
  feed: {
    palette: 'amber',
    main: rr(20, 11, 24, 8, 3) + rr(16, 22, 32, 31, 8),
    accent: circ(26, 41, 4.6) + circ(37.5, 44, 4) + circ(36, 32.5, 3.4),
  },
  /** Water drop with a sparkle. */
  clean: {
    palette: 'aqua',
    main: 'M31 11C31 11 46 27 46 38A15 15 0 0 1 16 38C16 27 31 11 31 11Z',
    accent: SPARKLE(45, 21, 9.5),
  },
  /** Scallop shell with a pearl. */
  collect: {
    palette: 'coral',
    main: 'M32 51C23 51 11 43 11 30A21 21 0 0 1 53 30C53 43 41 51 32 51Z' + rr(25, 47, 14, 7, 3),
    accent: circ(45, 43, 7),
    lines: 'M32 47V14M28.5 47L20 18M35.5 47L44 18M26 46L13.5 28M38 46L50.5 28',
  },
  /** Patterned egg. */
  hatchery: {
    palette: 'pink',
    main: 'M32 10C42 10 49 25 49 36A17 17 0 0 1 15 36C15 25 22 10 32 10Z',
    accent: 'M17.5 32.5L22.3 36.5L27.2 31.5L32 36.5L36.8 31.5L41.7 36.5L46.5 32.5V39.5L41.7 43.5L36.8 38.5L32 43.5L27.2 38.5L22.3 43.5L17.5 39.5Z',
  },
  /** Shopping bag with a star. */
  shop: {
    palette: 'violet',
    main: 'M21 25V22A11 11 0 0 1 43 22V25H38.5V22A6.5 6.5 0 0 0 25.5 22V25Z' + rr(14, 23.5, 36, 30, 8),
    accent: 'M32 30.5L34.06 35.67L39.61 36.03L35.33 39.58L36.7 44.97L32 42L27.3 44.97L28.67 39.58L24.39 36.03L29.94 35.67Z',
  },
  /** Tank on its stand with a fish inside. */
  tank: {
    palette: 'blue',
    main: rr(10, 15, 44, 31, 7) + rr(18, 48.5, 28, 4.5, 2.2),
    accent: 'M25 30.5L18 35.5V25.5Z' + 'M23 30.5a9.5 5.8 0 1 1 19 0a9.5 5.8 0 1 1 -19 0Z',
  },
  /** Notebook with a bookmark. */
  journal: {
    palette: 'green',
    main: rr(15, 11, 34, 42, 7),
    accent: 'M36.5 8.5H45.5V27.5L41 23.5L36.5 27.5Z',
    lines: 'M22.5 24H31M22.5 32H41.5M22.5 39H41.5M22.5 46H34',
  },
  /** Camera with a coloured lens. */
  photo: {
    palette: 'slate',
    main: rr(23, 13, 18, 11, 4) + rr(10, 19.5, 44, 31, 8),
    accent: circ(32, 35, 9),
    dots: circ(46, 26.5, 1.8),
  },
  /** Level-up star with an arrow. */
  level: {
    palette: 'sun',
    main: 'M32 12L37.9 25.8L52.9 27.2L41.6 37.1L44.9 51.8L32 44.1L19.1 51.8L22.4 37.1L11.1 27.2L26.1 25.8Z',
    accent: 'M32 24.5L39.5 33H34.8V42H29.2V33H24.5Z',
  },
  /** Heart with a tear, for sad news. */
  heart: {
    palette: 'rose',
    main: 'M32 52C20 43 11 35 11 25.5C11 18 16.5 13 22.5 13C26.5 13 30 15 32 18.5C34 15 37.5 13 41.5 13C47.5 13 53 18 53 25.5C53 35 44 43 32 52Z',
    accent: 'M45.5 33C45.5 33 51.5 40 51.5 44.5A6 6 0 0 1 39.5 44.5C39.5 40 45.5 33 45.5 33Z',
  },
  /** Speech bubble, for the guided tour. */
  guide: {
    palette: 'violet',
    main: rr(10, 12, 44, 32, 10) + 'M21 40H34L18.5 53Z',
    accent: circ(22.5, 28, 3.3) + circ(32, 28, 3.3) + circ(41.5, 28, 3.3),
  },
} satisfies Record<string, Glyph>;

export type GlassIconName = keyof typeof GLYPHS;

let serial = 0;

/** Build one icon. Every instance gets its own id prefix so many can share a page. */
export function glassIcon(name: GlassIconName, size = 40, palette?: GlassPalette): SVGElement {
  const g: Glyph = GLYPHS[name];
  const c: Palette = PALETTES[palette ?? g.palette];
  const p = `gi${(serial++).toString(36)}`;
  const u = (id: string) => `url(#${p}-${id})`;
  const vgrad = (id: string, stops: [number, string, number?][], y1 = 0, y2 = 64) =>
    `<linearGradient id="${p}-${id}" x1="0" y1="${y1}" x2="0" y2="${y2}" gradientUnits="userSpaceOnUse">${stops
      .map(([o, col, a]) => `<stop offset="${o}" stop-color="${col}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`)
      .join('')}</linearGradient>`;

  return svg(`<svg class="gicon" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false">
<defs>
${vgrad('tile', [[0, c.light], [0.5, c.mid], [1, c.deep]])}
${vgrad('rim', [[0, '#fff', 0.7], [0.5, '#fff', 0.12], [1, '#fff', 0.3]])}
${vgrad('main', [[0, '#fff', 0.92], [1, c.pale, 0.72]], 10, 54)}
${vgrad('mrim', [[0, '#fff', 1], [0.5, '#fff', 0.35], [1, '#fff', 0.7]], 10, 54)}
<linearGradient id="${p}-acc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.a1}"/><stop offset="1" stop-color="${c.a2}"/></linearGradient>
<linearGradient id="${p}-hi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>
<path id="${p}-m" d="${g.main}"/>
<path id="${p}-a" d="${g.accent}"/>
<clipPath id="${p}-cm"><use href="#${p}-m"/></clipPath>
<clipPath id="${p}-ct"><rect width="64" height="64" rx="14.5"/></clipPath>
<mask id="${p}-om" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><use href="#${p}-m" fill="#000"/></mask>
<mask id="${p}-oa" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><use href="#${p}-a" fill="#000"/></mask>
<filter id="${p}-b2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="${p}-b1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1"/></filter>
</defs>
<rect width="64" height="64" rx="14.5" fill="${u('tile')}"/>
<rect x=".6" y=".6" width="62.8" height="62.8" rx="13.9" fill="none" stroke="${u('rim')}" stroke-width="1.2"/>
<g clip-path="${u('ct')}" mask="${u('om')}"><use href="#${p}-m" transform="translate(0 2.5)" fill="${c.dark}" opacity=".32" filter="${u('b2')}"/></g>
<use href="#${p}-m" fill="${u('main')}"/>
<use href="#${p}-m" fill="none" stroke="${u('mrim')}" stroke-width="2" stroke-linejoin="round" clip-path="${u('cm')}"/>
${g.lines ? `<path d="${g.lines}" fill="none" stroke="${c.deep}" stroke-opacity=".32" stroke-width="1.3" stroke-linecap="round" clip-path="${u('cm')}"/>` : ''}
${g.dots ? `<path d="${g.dots}" fill="${c.deep}" opacity=".42"/>` : ''}
<g clip-path="${u('ct')}" mask="${u('oa')}"><use href="#${p}-a" transform="translate(0 1.5)" fill="${c.dark}" opacity=".35" filter="${u('b1')}"/></g>
<use href="#${p}-a" fill="${u('acc')}" fill-opacity=".94" stroke="${u('acc')}" stroke-width="1.6" stroke-linejoin="round"/>
<use href="#${p}-a" fill="none" stroke="${u('hi')}" stroke-width=".7" stroke-linejoin="round"/>
</svg>`);
}

import type { Impact } from '../core/index.ts';
import { BLOCK_GLYPHS, DEFAULT_HUES, type MapGlyphs } from './map/layout.ts';

export interface Theme {
  name: string;
  text: string;
  muted: string;
  accent: string;
  activeBg: string;
  border: string;
  panel: string;
  scrim: string;
  ok: string;
  warn: string;
  error: string;
  hues: number[];
  impact: Record<Impact, string>;
}

export const THEMES: Theme[] = [
  {
    name: 'dark',
    text: '#e4e4e4',
    muted: '#808080',
    accent: '#00d7d7',
    activeBg: '#2f3646',
    border: '#444444',
    panel: '#1c1f26',
    scrim: '#000000a0',
    ok: '#5fd787',
    warn: '#d7af5f',
    error: '#ff5f5f',
    hues: DEFAULT_HUES,
    impact: { regenerates: '#5fd787', rebuild: '#5fafd7', redownload: '#d7af5f', unknown: '#d787d7', dataloss: '#ff5f5f' },
  },
  {
    name: 'light',
    text: '#1c1c1c',
    muted: '#6c6c6c',
    accent: '#005f87',
    activeBg: '#d7e3f0',
    border: '#a8a8a8',
    panel: '#f4f4f4',
    scrim: '#ffffff99',
    ok: '#007f3f',
    warn: '#875f00',
    error: '#c00000',
    hues: [215, 25, 145, 285, 345, 185, 45, 105, 250, 320],
    impact: { regenerates: '#007f3f', rebuild: '#005f87', redownload: '#875f00', unknown: '#87008f', dataloss: '#c00000' },
  },
  {
    name: 'high contrast',
    text: '#ffffff',
    muted: '#c0c0c0',
    accent: '#00ffff',
    activeBg: '#0000af',
    border: '#ffffff',
    panel: '#000000',
    scrim: '#000000d0',
    ok: '#00ff00',
    warn: '#ffff00',
    error: '#ff0000',
    hues: [210, 30, 120, 290, 0, 180, 60, 90, 240, 320],
    impact: { regenerates: '#00ff00', rebuild: '#00afff', redownload: '#ffff00', unknown: '#ff00ff', dataloss: '#ff0000' },
  },
];

export type IconSet = 'unicode' | 'ascii' | 'nerd';

export const ICON_SETS: IconSet[] = ['unicode', 'ascii', 'nerd'];

export interface Icons {
  swatch: string;
  running: string;
  pending: string;
  done: string;
  failed: string;
  skipped: string;
  barFull: string;
  barEmpty: string;
  caps: { info: string; warn: string; error: string };
  map: MapGlyphs;
  category: (name: string) => string;
}

const UNICODE: Icons = {
  swatch: '●',
  running: '◌',
  pending: '·',
  done: '✓',
  failed: '✗',
  skipped: '↷',
  barFull: '█',
  barEmpty: '░',
  caps: { info: '▎', warn: '▌', error: '▊' },
  map: BLOCK_GLYPHS,
  category: () => '',
};

const NERD_CATEGORIES: Record<string, string> = {
  Projects: '\u{f07b}',
  'Package managers': '\u{f487}',
  Toolchains: '\u{f0ad}',
  'Browsers, models & test runners': '\u{f059f}',
  Containers: '\u{f308}',
  'Xcode & Apple': '\u{f179}',
  'Editors & IDEs': '\u{f044}',
  System: '\u{f109}',
};

export const ICONS: Record<IconSet, Icons> = {
  unicode: UNICODE,
  nerd: { ...UNICODE, category: (name) => (NERD_CATEGORIES[name] ? `${NERD_CATEGORIES[name]} ` : '') },
  ascii: {
    swatch: '*',
    running: '>',
    pending: '.',
    done: '+',
    failed: 'x',
    skipped: '-',
    barFull: '#',
    barEmpty: '.',
    caps: { info: '-', warn: '!', error: '#' },
    map: { top: '"', bottom: '.', edgeRight: '|', edgeBottom: '_' },
    category: () => '',
  },
};

export function themeNamed(name: string | undefined): Theme {
  return THEMES.find((t) => t.name === name) ?? THEMES[0];
}

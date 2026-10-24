import type { KeyEvent } from '@opentui/core';
import { type Hint, type HintPriority } from './hints.ts';

export type Context =
  | 'list'
  | 'filter'
  | 'files'
  | 'map'
  | 'preview'
  | 'tools'
  | 'review'
  | 'progress'
  | 'failure'
  | 'done'
  | 'help'
  | 'helpSearch'
  | 'messages'
  | 'sort'
  | 'theme'
  | 'welcome';

export type Action =
  | 'up'
  | 'down'
  | 'pageUp'
  | 'pageDown'
  | 'top'
  | 'bottom'
  | 'expand'
  | 'collapse'
  | 'open'
  | 'parent'
  | 'back'
  | 'previous'
  | 'next'
  | 'toggle'
  | 'all'
  | 'expandAll'
  | 'focus'
  | 'focusBack'
  | 'filter'
  | 'ageUp'
  | 'ageDown'
  | 'sort'
  | 'reverse'
  | 'map'
  | 'trash'
  | 'clean'
  | 'rescan'
  | 'messages'
  | 'theme'
  | 'help'
  | 'quit'
  | 'confirm'
  | 'cancel'
  | 'search'
  | 'retry'
  | 'skip'
  | 'skipAll'
  | 'abort'
  | 'dismiss';

export interface Binding {
  action: Action;
  keys: string[];
  label: string;
  section: string;
  contexts: Context[];
  priority?: HintPriority;
  display?: string;
  footer?: boolean;
}

const MAIN: Context[] = ['list', 'files', 'map', 'preview'];
const SCROLL: Context[] = ['preview', 'review', 'help', 'messages'];

export const BINDINGS: Binding[] = [
  { action: 'down', keys: ['down', 'j'], label: 'move', section: 'Move', contexts: ['list', 'files', 'tools', 'sort', 'theme'], display: '↑↓' },
  { action: 'up', keys: ['up', 'k'], label: 'move up', section: 'Move', contexts: ['list', 'files', 'tools', 'sort', 'theme'], footer: false },
  { action: 'down', keys: ['down', 'j'], label: 'scroll', section: 'Move', contexts: SCROLL, display: '↑↓' },
  { action: 'up', keys: ['up', 'k'], label: 'scroll up', section: 'Move', contexts: SCROLL, footer: false },
  { action: 'pageDown', keys: ['pagedown'], label: 'page down', section: 'Move', contexts: ['list', 'files', ...SCROLL], footer: false },
  { action: 'pageUp', keys: ['pageup'], label: 'page up', section: 'Move', contexts: ['list', 'files', ...SCROLL], footer: false },
  { action: 'top', keys: ['home', 'g'], label: 'first row', section: 'Move', contexts: ['list', 'files', 'help', 'messages', 'review'], footer: false },
  { action: 'bottom', keys: ['end', 'G'], label: 'last row', section: 'Move', contexts: ['list', 'files', 'help', 'messages', 'review'], footer: false },
  { action: 'expand', keys: ['right', 'l'], label: 'expand', section: 'Move', contexts: ['list'], display: '→/←', priority: 'optional' },
  { action: 'collapse', keys: ['left', 'h'], label: 'collapse', section: 'Move', contexts: ['list'], footer: false },
  { action: 'open', keys: ['return', 'f'], label: 'files', section: 'Files', contexts: ['list'], display: 'enter/f' },
  { action: 'cancel', keys: ['escape'], label: 'clear the filter', section: 'Views', contexts: ['list', 'map', 'preview'], footer: false },
  { action: 'open', keys: ['return', 'right', 'l'], label: 'open', section: 'Files', contexts: ['files'], display: 'enter' },
  { action: 'parent', keys: ['left', 'backspace', 'h'], label: 'up', section: 'Files', contexts: ['files'], display: '←' },
  { action: 'back', keys: ['escape', 'f'], label: 'back', section: 'Files', contexts: ['files'], display: 'esc/f', priority: 'essential' },
  { action: 'previous', keys: ['left', 'h'], label: 'previous slice', section: 'Map', contexts: ['map'], footer: false },
  { action: 'next', keys: ['right', 'l'], label: 'next slice', section: 'Map', contexts: ['map'], display: '←→', priority: 'essential' },
  { action: 'parent', keys: ['up', 'k'], label: 'out', section: 'Map', contexts: ['map'], display: '↑' },
  { action: 'open', keys: ['down', 'j', 'return'], label: 'in', section: 'Map', contexts: ['map'], display: '↓' },
  { action: 'toggle', keys: ['space'], label: 'toggle', section: 'Select', contexts: [...MAIN, 'tools'], priority: 'essential' },
  { action: 'all', keys: ['a'], label: 'all', section: 'Select', contexts: ['list', 'tools'], priority: 'optional' },
  { action: 'expandAll', keys: ['e'], label: 'expand all groups', section: 'Select', contexts: ['list'], footer: false },
  { action: 'ageUp', keys: [']'], label: 'age', section: 'Select', contexts: MAIN, display: '[ ]' },
  { action: 'ageDown', keys: ['['], label: 'lower age threshold', section: 'Select', contexts: MAIN, footer: false },
  { action: 'focus', keys: ['tab'], label: 'focus', section: 'Views', contexts: MAIN },
  { action: 'focusBack', keys: ['shift+tab'], label: 'focus back', section: 'Views', contexts: MAIN, footer: false },
  { action: 'filter', keys: ['/'], label: 'filter', section: 'Views', contexts: ['list', 'map', 'preview'] },
  { action: 'sort', keys: ['o'], label: 'sort', section: 'Views', contexts: MAIN, priority: 'optional' },
  { action: 'reverse', keys: ['R'], label: 'reverse sort', section: 'Views', contexts: [...MAIN, 'sort'], footer: false },
  { action: 'map', keys: ['m'], label: 'map', section: 'Views', contexts: MAIN, priority: 'optional' },
  { action: 'messages', keys: ['w'], label: 'messages', section: 'Views', contexts: MAIN, priority: 'optional' },
  { action: 'theme', keys: ['T'], label: 'theme', section: 'Views', contexts: MAIN, priority: 'optional', footer: false },
  { action: 'trash', keys: ['t'], label: 'trash', section: 'Clean', contexts: MAIN, priority: 'optional' },
  { action: 'clean', keys: ['d'], label: 'clean', section: 'Clean', contexts: MAIN, priority: 'essential' },
  { action: 'rescan', keys: ['r'], label: 'rescan', section: 'Clean', contexts: MAIN, priority: 'optional' },
  { action: 'help', keys: ['?'], label: 'help', section: 'Views', contexts: MAIN, priority: 'essential' },
  { action: 'quit', keys: ['q'], label: 'quit', section: 'Views', contexts: MAIN, priority: 'essential' },
  { action: 'confirm', keys: ['return'], label: 'apply', section: 'Filter', contexts: ['filter'], display: 'enter', priority: 'essential' },
  { action: 'cancel', keys: ['escape'], label: 'clear', section: 'Filter', contexts: ['filter'], display: 'esc', priority: 'essential' },
  { action: 'all', keys: ['a'], label: 'all', section: 'Native tools', contexts: ['tools'], footer: false },
  { action: 'confirm', keys: ['return'], label: 'review the cleanup', section: 'Native tools', contexts: ['tools'], display: 'enter', priority: 'essential' },
  { action: 'cancel', keys: ['escape', 'n'], label: 'cancel', section: 'Native tools', contexts: ['tools'], display: 'esc', priority: 'essential' },
  { action: 'confirm', keys: ['y'], label: 'clean now', section: 'Review', contexts: ['review'], priority: 'essential' },
  { action: 'cancel', keys: ['n', 'escape'], label: 'cancel', section: 'Review', contexts: ['review'], display: 'n/esc', priority: 'essential' },
  { action: 'retry', keys: ['r'], label: 'retry', section: 'When an item fails', contexts: ['failure'], priority: 'essential' },
  { action: 'skip', keys: ['s'], label: 'skip', section: 'When an item fails', contexts: ['failure'], priority: 'essential' },
  { action: 'skipAll', keys: ['S'], label: 'skip all failures', section: 'When an item fails', contexts: ['failure'], priority: 'essential' },
  { action: 'abort', keys: ['a'], label: 'abort', section: 'When an item fails', contexts: ['failure'], priority: 'essential' },
  { action: 'back', keys: ['return', 'escape', 'q'], label: 'back to list', section: 'Review', contexts: ['done'], display: 'enter', priority: 'essential' },
  { action: 'search', keys: ['/'], label: 'search', section: 'Help', contexts: ['help'], priority: 'essential' },
  { action: 'cancel', keys: ['escape', '?', 'q'], label: 'close', section: 'Help', contexts: ['help'], display: 'esc', priority: 'essential' },
  { action: 'cancel', keys: ['escape'], label: 'stop searching', section: 'Help', contexts: ['helpSearch'], display: 'esc', priority: 'essential' },
  { action: 'confirm', keys: ['return'], label: 'keep results', section: 'Help', contexts: ['helpSearch'], display: 'enter' },
  { action: 'cancel', keys: ['escape', 'w', 'q'], label: 'close', section: 'Messages', contexts: ['messages'], display: 'esc', priority: 'essential' },
  { action: 'confirm', keys: ['return'], label: 'apply', section: 'Sort', contexts: ['sort'], display: 'enter', priority: 'essential' },
  { action: 'cancel', keys: ['escape', 'o'], label: 'close', section: 'Sort', contexts: ['sort'], display: 'esc', priority: 'essential' },
  { action: 'confirm', keys: ['return'], label: 'keep theme', section: 'Theme', contexts: ['theme'], display: 'enter', priority: 'essential' },
  { action: 'cancel', keys: ['escape', 'T'], label: 'restore', section: 'Theme', contexts: ['theme'], display: 'esc', priority: 'essential' },
  { action: 'dismiss', keys: ['any'], label: 'continue', section: 'Welcome', contexts: ['welcome'], display: 'any key', priority: 'essential' },
];

const KEY_NAMES = new Set(['up', 'down', 'left', 'right', 'pageup', 'pagedown', 'home', 'end', 'return', 'escape', 'tab', 'backspace', 'delete', 'space']);

const DISPLAY: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→', return: 'enter', escape: 'esc', pageup: 'PgUp', pagedown: 'PgDn', 'shift+tab': 'S-tab' };

export function keyToken(event: Pick<KeyEvent, 'name' | 'sequence' | 'shift' | 'ctrl' | 'meta'>): string {
  if (event.name === 'tab' && event.shift) return 'shift+tab';
  if (KEY_NAMES.has(event.name)) return event.name;
  if (event.sequence.length === 1 && !event.ctrl && !event.meta) return event.sequence === ' ' ? 'space' : event.sequence;
  return event.name;
}

export function printable(event: Pick<KeyEvent, 'sequence' | 'ctrl' | 'meta'>): string {
  return event.sequence.length === 1 && !event.ctrl && !event.meta && event.sequence >= ' ' ? event.sequence : '';
}

export function bindingsFor(context: Context): Binding[] {
  return BINDINGS.filter((b) => b.contexts.includes(context));
}

export function resolve(context: Context, token: string): Action | undefined {
  return bindingsFor(context).find((b) => b.keys.includes(token) || b.keys.includes('any'))?.action;
}

export function displayKeys(binding: Binding): string {
  return binding.display ?? binding.keys.map((k) => DISPLAY[k] ?? k).join('/');
}

export function footerHints(context: Context): Hint[] {
  return bindingsFor(context)
    .filter((b) => b.footer !== false)
    .map((b) => ({ key: displayKeys(b), label: b.label, priority: b.priority ?? 'normal' }));
}

export interface HelpSection {
  title: string;
  rows: { keys: string; label: string }[];
}

export function helpSections(): HelpSection[] {
  const sections = new Map<string, Map<string, { keys: string; label: string }>>();
  for (const b of BINDINGS) {
    const rows = sections.get(b.section) ?? new Map();
    sections.set(b.section, rows);
    const keys = b.keys.map((k) => DISPLAY[k] ?? k).join(' ');
    rows.set(`${keys}|${b.label}`, { keys, label: b.label });
  }
  return [...sections.entries()].map(([title, rows]) => ({ title, rows: [...rows.values()] }));
}

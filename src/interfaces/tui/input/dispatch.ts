import { SORT_KEYS, type Sort } from '../../../domain/sort.ts';
import type { Decision } from '../../../domain/run-plan.ts';
import type { Target, Tool } from '../../../domain/types.ts';
import type { Action, Context } from '../keys.ts';
import { type MapNode, ancestry } from '../map/layout.ts';
import { type Groups, type Row, sectionKey } from '../model/rows.ts';
import type { Browser } from '../state/useBrowse.ts';
import { THEMES } from '../theme.ts';
import type { MapMode } from '../views/MapPane.tsx';

export type Overlay = 'welcome' | 'help' | 'messages' | 'sort' | 'theme' | 'tools' | 'review' | 'progress';
export type Focus = 'list' | 'preview' | 'map';
type Set<T> = (value: T | ((previous: T) => T)) => void;

interface Controls {
  rows: Row[];
  groups: Groups;
  tree: MapNode;
  cursor: () => number;
  moveTo: (index: number) => void;
  listRows: number;
  pageRows: number;
  previewPage: number;
  previewMax: number;
  toggle: (targets: Target[]) => void;
  reveal: (key: string) => void;
  browser: Browser;
  openFiles: (target: Target) => void;
  stepAge: (direction: 1 | -1) => void;
  cycleFocus: (direction: 1 | -1) => void;
  focus: Focus;
  setFocus: (focus: Focus) => void;
  filter: string;
  setFilter: Set<string>;
  setFiltering: (on: boolean) => void;
  setCollapsed: Set<globalThis.Set<string>>;
  setExpanded: Set<globalThis.Set<string>>;
  sort: Sort;
  setSort: Set<Sort>;
  sortCursor: number;
  setSortCursor: Set<number>;
  mapMode: MapMode;
  setMapMode: Set<MapMode>;
  openDialog: (overlay: Overlay) => void;
  closeDialog: () => void;
  setDialogOffset: Set<number>;
  setPreviewOffset: Set<number>;
  themeName: string;
  setThemeName: (name: string) => void;
  themeBefore: string;
  setThemeBefore: (name: string) => void;
  toggleTrash: () => void;
  startClean: () => void;
  runCleanup: () => void;
  finishClean: () => void;
  decide: (decision: Decision) => void;
  rescan: () => void;
  openHelp: () => void;
  setHelpSearching: (on: boolean) => void;
  setHelpQuery: Set<string>;
  tools: Tool[];
  toolCursor: number;
  setToolCursor: Set<number>;
  setInstall: Set<globalThis.Set<string>>;
  setUninstallAfter: Set<boolean>;
  saveState: (patch: { welcomed?: boolean; theme?: string }) => void;
  say: (text: string) => void;
  quit: () => void;
}

const SCROLL: Partial<Record<Action, (offset: number, page: number) => number>> = {
  down: (o) => o + 1,
  up: (o) => Math.max(0, o - 1),
  pageDown: (o, page) => o + page,
  pageUp: (o, page) => Math.max(0, o - page),
  top: () => 0,
  bottom: () => 100_000,
};

const without = <T>(values: globalThis.Set<T>, value: T) => new Set([...values].filter((v) => v !== value));

export function createDispatch(c: Controls): (context: Context, action: Action) => void {
  const row = () => c.rows[Math.min(c.cursor(), c.rows.length - 1)];
  const toggleCurrent = () => {
    if (c.browser.browse) return c.toggle([c.browser.browse.target]);
    const r = row();
    if (r) c.toggle(r.kind === 'target' ? [r.target] : r.targets);
  };

  const scrollDialog = (action: Action): boolean => {
    const step = SCROLL[action];
    if (step) c.setDialogOffset((o) => step(o, c.pageRows));
    return Boolean(step);
  };

  const mapStep = (action: Action) => {
    const { browse } = c.browser;
    if (browse) {
      if (action === 'next') c.browser.move((i) => i + 1);
      if (action === 'previous') c.browser.move((i) => i - 1);
      if (action === 'parent') c.browser.leaveDir();
      if (action === 'open') c.browser.enterEntry();
      return;
    }
    const r = row();
    if (!r) return;
    if (r.kind === 'section') {
      const first = c.groups.find(([g]) => sectionKey(g) === r.key)?.[0];
      if (action === 'open' && first) c.reveal(first);
      return;
    }
    const chain = ancestry(c.tree, r.key);
    const parent = chain.at(-2);
    if ((action === 'next' || action === 'previous') && parent) {
      const index = parent.children.findIndex((n) => n.key === r.key);
      c.reveal(parent.children[(index + (action === 'next' ? 1 : -1) + parent.children.length) % parent.children.length].key);
    }
    if (action === 'parent' && parent && parent.key !== 'root') c.reveal(parent.key);
    if (action === 'open') {
      if (r.kind === 'target') c.openFiles(r.target);
      else if (chain.at(-1)?.children[0]) c.reveal(chain.at(-1)!.children[0].key);
    }
  };

  const common = (action: Action) => {
    if (action === 'ageUp') c.stepAge(1);
    if (action === 'ageDown') c.stepAge(-1);
    if (action === 'focus') c.cycleFocus(1);
    if (action === 'focusBack') c.cycleFocus(-1);
    if (action === 'filter') {
      c.setFocus('list');
      c.setFiltering(true);
    }
    if (action === 'sort') {
      c.setSortCursor(SORT_KEYS.findIndex((k) => k.key === c.sort.key));
      c.openDialog('sort');
    }
    if (action === 'reverse') c.setSort((s) => ({ ...s, reverse: !s.reverse }));
    if (action === 'map') {
      c.setMapMode((m) => (m === 'sunburst' ? 'treemap' : m === 'treemap' ? 'off' : 'sunburst'));
      if (c.mapMode === 'treemap' && c.focus === 'map') c.setFocus('list');
    }
    if (action === 'messages') c.openDialog('messages');
    if (action === 'theme') {
      c.setThemeBefore(c.themeName);
      c.openDialog('theme');
    }
    if (action === 'trash') c.toggleTrash();
    if (action === 'clean') c.startClean();
    if (action === 'rescan') c.rescan();
    if (action === 'help') c.openHelp();
    if (action === 'quit') c.quit();
    if (action === 'cancel' && c.filter) c.setFilter('');
  };

  const list = (action: Action) => {
    const r = row();
    const at = c.cursor();
    const moves: Partial<Record<Action, number>> = { down: at + 1, up: at - 1, pageDown: at + c.listRows, pageUp: at - c.listRows, top: 0, bottom: c.rows.length - 1 };
    if (moves[action] !== undefined) return c.moveTo(moves[action]!);
    if (action === 'toggle' && r) {
      c.toggle(r.kind === 'target' ? [r.target] : r.targets);
      if (r.kind === 'target') c.moveTo(at + 1);
      return;
    }
    if ((action === 'expand' || action === 'open') && r) {
      if (r.kind === 'group' || r.kind === 'section') c.setCollapsed((s) => without(s, r.key));
      if (r.kind === 'plugin') c.setExpanded((s) => new Set(s).add(r.key));
      if (r.kind === 'target' && action === 'open') c.openFiles(r.target);
      return;
    }
    if (action === 'collapse' && r) {
      if (r.kind === 'group' || r.kind === 'section') c.setCollapsed((s) => new Set(s).add(r.key));
      if (r.kind === 'plugin') c.setExpanded((s) => without(s, r.key));
      if (r.kind === 'target') {
        c.setExpanded((s) => without(s, r.parent));
        c.moveTo(c.rows.findIndex((x) => x.key === r.parent));
      }
      return;
    }
    if (action === 'all') {
      const visible = c.rows.flatMap((x) => (x.kind === 'target' ? [x.target] : []));
      return c.toggle(visible.length ? visible : c.groups.flatMap(([, plugins]) => plugins.flatMap(([, targets]) => targets)));
    }
    if (action === 'expandAll') return c.setExpanded((s) => (s.size ? new Set() : new Set(c.rows.filter((x) => x.kind === 'plugin').map((x) => x.key))));
    common(action);
  };

  const files = (action: Action) => {
    const moves: Partial<Record<Action, (i: number) => number>> = { down: (i) => i + 1, up: (i) => i - 1, pageDown: (i) => i + c.listRows, pageUp: (i) => i - c.listRows, top: () => 0, bottom: () => Number.MAX_SAFE_INTEGER };
    if (moves[action]) return c.browser.move(moves[action]!);
    if (action === 'open') return c.browser.enterEntry();
    if (action === 'parent') return c.browser.goUp();
    if (action === 'back') return c.browser.close();
    if (action === 'toggle') return toggleCurrent();
    common(action);
  };

  const tools = (action: Action) => {
    const count = c.tools.length;
    if (action === 'down') c.setToolCursor((i) => Math.min(count, i + 1));
    if (action === 'up') c.setToolCursor((i) => Math.max(0, i - 1));
    if (action === 'toggle' && c.toolCursor === count) c.setUninstallAfter((u) => !u);
    else if (action === 'toggle') {
      const bin = c.tools[c.toolCursor].bin;
      c.setInstall((s) => (s.has(bin) ? without(s, bin) : new Set(s).add(bin)));
    }
    if (action === 'all') c.setInstall((s) => (s.size === count ? new Set() : new Set(c.tools.map((t) => t.bin))));
    if (action === 'confirm') c.openDialog('review');
    if (action === 'cancel') c.closeDialog();
  };

  const theme = (action: Action) => {
    const index = THEMES.findIndex((t) => t.name === c.themeName);
    if (action === 'down' || action === 'up') c.setThemeName(THEMES[Math.max(0, Math.min(THEMES.length - 1, index + (action === 'down' ? 1 : -1)))].name);
    if (action === 'confirm') {
      c.saveState({ theme: c.themeName });
      c.say(`Theme "${c.themeName}" saved.`);
      c.closeDialog();
    }
    if (action === 'cancel') {
      c.setThemeName(c.themeBefore);
      c.closeDialog();
    }
  };

  const handlers: Record<Context, (action: Action) => void> = {
    welcome: () => {
      c.closeDialog();
      c.saveState({ welcomed: true });
    },
    filter: (action) => {
      if (action === 'cancel') c.setFilter('');
      c.setFiltering(false);
    },
    tools,
    review: (action) => {
      if (scrollDialog(action)) return;
      if (action === 'confirm') c.runCleanup();
      if (action === 'cancel') c.closeDialog();
    },
    progress: () => undefined,
    failure: (action) => {
      if (action === 'retry' || action === 'skip' || action === 'skipAll' || action === 'abort') c.decide(action);
    },
    done: () => c.finishClean(),
    help: (action) => {
      if (scrollDialog(action)) return;
      if (action === 'search') c.setHelpSearching(true);
      if (action === 'cancel') c.closeDialog();
    },
    helpSearch: (action) => {
      if (action === 'cancel') c.setHelpQuery('');
      c.setHelpSearching(false);
    },
    messages: (action) => {
      if (!scrollDialog(action) && action === 'cancel') c.closeDialog();
    },
    sort: (action) => {
      if (action === 'down') c.setSortCursor((i) => Math.min(SORT_KEYS.length - 1, i + 1));
      if (action === 'up') c.setSortCursor((i) => Math.max(0, i - 1));
      if (action === 'reverse') c.setSort((s) => ({ ...s, reverse: !s.reverse }));
      if (action === 'confirm') c.setSort((s) => ({ ...s, key: SORT_KEYS[c.sortCursor].key }));
      if (action === 'confirm' || action === 'cancel') c.closeDialog();
    },
    theme,
    preview: (action) => {
      const step = SCROLL[action];
      if (step && action !== 'top' && action !== 'bottom') return c.setPreviewOffset((o) => Math.min(c.previewMax, step(o, c.previewPage)));
      if (action === 'toggle') return toggleCurrent();
      common(action);
    },
    map: (action) => {
      if (action === 'next' || action === 'previous' || action === 'parent' || action === 'open') return mapStep(action);
      if (action === 'toggle') return toggleCurrent();
      common(action);
    },
    files,
    list,
  };

  return (context, action) => handlers[context](action);
}

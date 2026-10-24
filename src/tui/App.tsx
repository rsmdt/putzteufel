import path from 'node:path';
import type { KeyEvent } from '@opentui/core';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Hooks, type Operation, type Plugin, type ScanContext, type Target, describeCommand, logOperation, trashAvailable, dirEntries, entrySizes, human, isYounger, listing, preselect, tildify } from '../core/index.ts';
import { overlapIndex, uniqueSize } from '../engine/overlap.ts';
import { missingTools } from '../engine/run.ts';
import { Footer, HeaderBar, MessageBar, modeColor } from './components/Chrome.tsx';
import { type Action, type Context, keyToken, printable, resolve } from './keys.ts';
import { LookContext } from './look.ts';
import { ancestry } from './map/layout.ts';
import { type Browse, browseMap, currentEntry, currentLevel, enter, leave, moveCursor, openBrowse, sortLevel, withLevel } from './model/browse.ts';
import { type Line, impactLines, legendLines, reviewLines, toolLines } from './model/explain.ts';
import { type Level, type Message, message } from './model/messages.ts';
import { buildMap, buildRows, colorIndex, groupTargets, sectionKey, stats } from './model/rows.ts';
import { DEFAULT_SORT, SORT_KEYS, type Sort, describeSort } from './sort.ts';
import { useCleanRun } from './state/useCleanRun.ts';
import { useScan } from './state/useScan.ts';
import { ICONS, type IconSet, THEMES, themeNamed } from './theme.ts';
import { HelpDialog, helpLines } from './views/dialogs/Help.tsx';
import { MessagesDialog } from './views/dialogs/Messages.tsx';
import { ProgressDialog } from './views/dialogs/Progress.tsx';
import { ReviewDialog } from './views/dialogs/Review.tsx';
import { dialogRows } from './views/dialogs/shared.tsx';
import { SortDialog } from './views/dialogs/Sort.tsx';
import { ThemeDialog } from './views/dialogs/Theme.tsx';
import { MIN_SIZE, TooSmall } from './views/dialogs/TooSmall.tsx';
import { ToolsDialog } from './views/dialogs/Tools.tsx';
import { WelcomeDialog } from './views/dialogs/Welcome.tsx';
import { FilesPane } from './views/FilesPane.tsx';
import { ListPane } from './views/ListPane.tsx';
import { MAP_MIN_WIDTH, MapPane, type MapMode } from './views/MapPane.tsx';
import { PreviewPane, previewRows } from './views/PreviewPane.tsx';

export const AGE_STEPS = [0, 1, 3, 7, 14, 30, 60, 90, 180, 365];
const SUNBURST_DEPTH = 3;

type Overlay = 'welcome' | 'help' | 'messages' | 'sort' | 'theme' | 'tools' | 'review' | 'progress';
type Focus = 'list' | 'preview' | 'map';

export interface AppProps {
  plugins: Plugin[];
  ctx: Omit<ScanContext, 'signal'>;
  configErrors?: string[];
  hooks?: Hooks;
  icons?: IconSet;
  theme?: string;
  firstRun?: boolean;
  onSaveState?: (patch: { welcomed?: boolean; theme?: string }) => void;
  onOperation?: (operation: Operation) => void;
  onExit: () => void;
}

export function App({ plugins, ctx, configErrors = [], hooks = {}, icons = 'unicode', theme: initialTheme, firstRun = false, onSaveState, onOperation = logOperation, onExit }: AppProps) {
  const { width, height } = useTerminalDimensions();
  const [messages, setMessages] = useState<Message[]>(configErrors.map((e) => message(e, 'error')));
  const say = (text: string, level: Level = 'info') => setMessages((all) => [...all.slice(-199), message(text, level)]);
  const minAgeRef = useRef(ctx.olderThan);
  const [minAge, setMinAge] = useState(ctx.olderThan);
  const scan = useScan(plugins, ctx, minAgeRef, (text) => say(text, 'warn'));
  const run = useCleanRun(onOperation);

  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const offsetRef = useRef(0);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [expanded, setExpanded] = useState(new Set<string>());
  const [filter, setFilter] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [useTrash, setUseTrash] = useState(false);
  const [canTrash, setCanTrash] = useState(false);
  const [browse, setBrowse] = useState<Browse | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(firstRun ? 'welcome' : null);
  const [focus, setFocus] = useState<Focus>('list');
  const [mapMode, setMapMode] = useState<MapMode>('sunburst');
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [sortCursor, setSortCursor] = useState(0);
  const [themeName, setThemeName] = useState(themeNamed(initialTheme).name);
  const [themeBefore, setThemeBefore] = useState(themeName);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [install, setInstall] = useState(new Set<string>());
  const [uninstallAfter, setUninstallAfter] = useState(true);
  const [toolCursor, setToolCursor] = useState(0);
  const [dialogOffset, setDialogOffset] = useState(0);
  const [helpQuery, setHelpQuery] = useState('');
  const [helpSearching, setHelpSearching] = useState(false);
  const [preview, setPreview] = useState<Line[]>([]);
  const [previewOffset, setPreviewOffset] = useState(0);
  const cleanedRef = useRef<Set<number>>(new Set());

  const look = useMemo(() => ({ theme: themeNamed(themeName), icons: ICONS[icons] }), [themeName, icons]);
  const theme = look.theme;
  const screen = { width, height };
  const bodyHeight = Math.max(6, height - 3);
  const showMap = mapMode !== 'off' && width >= MAP_MIN_WIDTH;
  const mapWidth = showMap ? Math.floor(width * 0.42) : 0;
  const leftWidth = width - mapWidth;
  const previewHeight = Math.max(5, Math.floor(bodyHeight * 0.32));
  const listHeight = Math.max(4, bodyHeight - previewHeight);
  const listRows = listHeight - 2;
  const pageRows = dialogRows(screen);

  const targets = scan.targets.current;
  const { groups, highlights } = useMemo(() => groupTargets(targets, filter, sort), [scan.version, filter, sort]);
  const rows = useMemo(() => buildRows(groups, filter, collapsed, expanded), [groups, collapsed, expanded]);
  const overlap = useMemo(() => overlapIndex(targets), [scan.version]);
  const tree = useMemo(() => buildMap(groups, theme.hues, new Map(targets.flatMap((t) => { const by = overlap.coveredBy(t); return by ? [[t.id, by] as [number, Target]] : []; }))), [groups, theme, overlap]);
  const colors = useMemo(() => colorIndex(tree), [tree]);
  const current = rows[Math.min(cursor, rows.length - 1)];
  if (cursor < offsetRef.current) offsetRef.current = cursor;
  else if (cursor >= offsetRef.current + listRows) offsetRef.current = cursor - listRows + 1;
  const offset = offsetRef.current;
  const selected = targets.filter((t) => t.selected);
  const descriptions = useMemo(() => new Map(plugins.map((p) => [p.name, p.description ?? ''])), [plugins]);
  const young = (t: Target) => isYounger(t, ctx.recentDays, minAge);
  const label = (t: Target) => (t.item && t.item !== t.label && !t.label.startsWith('/') && !t.label.startsWith('~') ? `${t.plugin} ${t.item}` : t.plugin);
  const shared = (t: Target) => [...new Set(overlap.sharedWith(t).map(label))];
  const ownersOf = (p: string) => (browse ? [...new Set(overlap.owners(p).filter((t) => t.id !== browse.target.id).map(label))] : []);
  const sharedLines = (t: Target): Line[] => {
    const others = overlap.sharedWith(t);
    if (!others.length) return [];
    const cover = overlap.coveredBy(t);
    return [
      { text: `Also touched by: ${others.map((o) => `${label(o)} (${tildify(o.label)})`).join(', ')}`, fg: theme.warn },
      ...(cover ? [{ text: `Counted once, under ${label(cover)}; when both are selected only ${label(cover)} cleans it.`, fg: theme.warn }] : []),
    ];
  };

  const overlayContext = (): Context | null => {
    if (!overlay) return null;
    if (overlay === 'help') return helpSearching ? 'helpSearch' : 'help';
    if (overlay === 'progress') return run.failure ? 'failure' : run.done ? 'done' : 'progress';
    return overlay;
  };
  const paneFocus: Focus = focus === 'map' && !showMap ? 'list' : focus;
  const baseContext: Context = filtering ? 'filter' : paneFocus === 'map' ? 'map' : paneFocus === 'preview' ? 'preview' : browse ? 'files' : 'list';
  const context = overlayContext() ?? baseContext;

  useEffect(() => {
    if (!pendingKey) return;
    const index = rows.findIndex((r) => r.key === pendingKey);
    if (index >= 0) moveTo(index);
    setPendingKey(null);
  }, [rows, pendingKey]);

  useEffect(() => {
    trashAvailable().then(setCanTrash);
  }, []);

  useEffect(() => setPreviewOffset(0), [current?.key, browse ? currentEntry(browse)?.path : undefined]);

  useEffect(() => {
    if (browse) return;
    if (!current) return setPreview([]);
    if (current.kind !== 'target') {
      const description = current.kind === 'plugin' ? descriptions.get(current.name) : '';
      const first = current.targets[0];
      const impact: Line[] = current.kind === 'plugin' && first ? impactLines(first, ctx.recentDays, minAgeRef.current, theme).slice(0, 1) : [];
      const tool = current.kind === 'plugin' && first && (first.tool?.clean.length || first.commands.length) ? toolLines(first, theme) : [];
      setPreview([`${current.name}: ${stats(current.targets)} selected`, ...impact, ...(description ? [description] : []), ...tool, 'space toggles the whole group, → expands, ← collapses, ? explains the tags']);
      return;
    }
    let cancelled = false;
    const t = current.target;
    const head = `${tildify(t.label)}  ·  ${human(t.size)}  ·  ${t.plugin}${t.item && t.item !== t.label ? ` / ${t.item}` : ''}${t.ageDays === undefined ? '' : `  ·  last changed ${Math.floor(t.ageDays)}d ago`}`;
    const explained: Line[] = [head, ...impactLines(t, ctx.recentDays, minAgeRef.current, theme), ...toolLines(t, theme), ...sharedLines(t)];
    setPreview(explained);
    const slow = setTimeout(() => !cancelled && setPreview([...explained, 'listing files…']), 500);
    const timer = setTimeout(() => {
      listing(t, 400).then(({ lines, truncated }) => {
        clearTimeout(slow);
        const prefix = tildify(t.label) + path.sep;
        const shown = lines.map((l) => (l.startsWith(prefix) ? `  ${l.slice(prefix.length)}` : l));
        if (!cancelled) setPreview([...explained, ...shown, ...(truncated ? ['… more files, press f to browse'] : [])]);
      });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(slow);
    };
  }, [current?.key, scan.version, browse === null, theme, overlap]);

  useEffect(() => {
    if (!browse) return;
    const level = currentLevel(browse);
    if (level.entries) return;
    let cancelled = false;
    (level.dir ? dirEntries(level.dir) : entrySizes(browse.target.paths)).then((entries) => {
      if (!cancelled) setBrowse((b) => (b ? withLevel(b, (l) => sortLevel({ ...l, entries }, sort)) : b));
    });
    return () => {
      cancelled = true;
    };
  }, [browse]);

  useEffect(() => {
    setBrowse((b) => (b ? { ...b, levels: b.levels.map((l) => sortLevel(l, sort)) } : b));
  }, [sort]);

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, index));
    cursorRef.current = next;
    setCursor(next);
  };
  const moveBrowse = (to: (c: number) => number) => setBrowse((b) => (b ? moveCursor(b, to, listRows) : b));

  const toggle = (list: Target[]) => {
    const value = !list.every((t) => t.selected);
    list.forEach((t) => (t.selected = value));
    scan.bump();
  };

  const stepAge = (direction: 1 | -1) => {
    const age = minAgeRef.current;
    const index = AGE_STEPS.findIndex((d) => d >= age);
    const from = index < 0 ? AGE_STEPS.length - 1 : AGE_STEPS[index] === age ? index : direction > 0 ? index - 1 : index;
    const days = AGE_STEPS[Math.max(0, Math.min(AGE_STEPS.length - 1, from + direction))];
    minAgeRef.current = days;
    setMinAge(days);
    for (const t of scan.targets.current) if (t.ageDays !== undefined) t.selected = preselect(t, ctx.recentDays, days);
    scan.bump();
    say(days ? `Selected items older than ${days} days (${scan.targets.current.filter((t) => t.selected).length} selected).` : 'Age threshold off: items of any age are selected by their tag.');
  };

  const reveal = (key: string) => {
    if (key === 'root') return;
    const chain = ancestry(tree, key);
    const category = chain[1]?.key;
    const plugin = chain[2]?.key;
    if (category) setCollapsed((s) => new Set([...s].filter((k) => k !== category && k !== sectionKey(category))));
    if (plugin && chain.length > 3) setExpanded((s) => new Set(s).add(plugin));
    setPendingKey(key);
  };

  const openFiles = (target: Target) => {
    setBrowse(openBrowse(target));
    setFocus('list');
  };
  const closeFiles = () => setBrowse(null);
  const leaveDir = () => setBrowse((b) => (b ? leave(b) : b));
  const enterEntry = () => {
    const entry = browse ? currentEntry(browse) : undefined;
    if (entry?.isDir) setBrowse((b) => (b ? enter(b, entry) : b));
  };

  const openDialog = (next: Overlay) => {
    setDialogOffset(0);
    setOverlay(next);
  };

  const startClean = () => {
    if (!selected.length) return say('Nothing is selected. Select items with space first.', 'warn');
    const tools = missingTools(selected);
    setInstall(new Set(tools.map((t) => t.bin)));
    setToolCursor(0);
    openDialog(tools.length ? 'tools' : 'review');
  };

  const runCleanup = () => {
    const targetsToClean = [...selected];
    openDialog('progress');
    run.start({ targets: targetsToClean, install: missingTools(targetsToClean).filter((t) => install.has(t.bin)), uninstallAfter, hooks, useTrash, trashAvailable: canTrash, minAge: minAgeRef.current }, (result) => {
      result.cleaned.forEach((id) => cleanedRef.current.add(id));
      const failed = result.steps.filter((s) => s.state === 'failed').length;
      say(`Cleaned ${result.cleaned.size} of ${targetsToClean.length} item(s), freed about ${human(result.freed)}${failed ? `, ${failed} step(s) failed` : ''}${result.aborted ? ', aborted' : ''}.`, failed || result.aborted ? 'warn' : 'info');
    });
  };

  const finishClean = () => {
    scan.targets.current = scan.targets.current.filter((t) => !cleanedRef.current.has(t.id));
    cleanedRef.current = new Set();
    setOverlay(null);
    setBrowse(null);
    run.reset();
    moveTo(cursorRef.current);
    scan.bump();
  };

  const focusOrder: Focus[] = showMap ? ['list', 'preview', 'map'] : ['list', 'preview'];
  const cycleFocus = (step: 1 | -1) => setFocus(focusOrder[(focusOrder.indexOf(paneFocus) + step + focusOrder.length) % focusOrder.length]);

  const currentRow = () => rows[Math.min(cursorRef.current, rows.length - 1)];

  const mapStep = (action: Action) => {
    if (browse) {
      if (action === 'next') moveBrowse((c) => c + 1);
      if (action === 'previous') moveBrowse((c) => c - 1);
      if (action === 'parent') leaveDir();
      if (action === 'open') enterEntry();
      return;
    }
    const row = currentRow();
    if (!row) return;
    if (row.kind === 'section') {
      const first = groups.find(([g]) => sectionKey(g) === row.key)?.[0];
      if (action === 'open' && first) reveal(first);
      return;
    }
    const chain = ancestry(tree, row.key);
    const node = chain.at(-1);
    const parent = chain.at(-2);
    if ((action === 'next' || action === 'previous') && parent) {
      const siblings = parent.children;
      const index = siblings.findIndex((n) => n.key === row.key);
      reveal(siblings[(index + (action === 'next' ? 1 : -1) + siblings.length) % siblings.length].key);
    }
    if (action === 'parent' && parent && parent.key !== 'root') reveal(parent.key);
    if (action === 'open') {
      if (row.kind === 'target') openFiles(row.target);
      else if (node?.children[0]) reveal(node.children[0].key);
    }
  };

  const onMapPick = (key: string | 'center') => {
    if (browse) {
      const entries = currentLevel(browse).entries ?? [];
      if (key === 'center') return leaveDir();
      const index = entries.findIndex((e) => e.path === key);
      if (index < 0) return;
      if (index === currentLevel(browse).cursor && entries[index].isDir) return enterEntry();
      return moveBrowse(() => index);
    }
    if (key === 'center') return mapStep('parent');
    reveal(key);
  };

  const common = (action: Action): boolean => {
    switch (action) {
      case 'ageUp':
        stepAge(1);
        return true;
      case 'ageDown':
        stepAge(-1);
        return true;
      case 'focus':
        cycleFocus(1);
        return true;
      case 'focusBack':
        cycleFocus(-1);
        return true;
      case 'filter':
        setFocus('list');
        setFiltering(true);
        return true;
      case 'sort':
        setSortCursor(SORT_KEYS.findIndex((k) => k.key === sort.key));
        openDialog('sort');
        return true;
      case 'reverse':
        setSort((s) => ({ ...s, reverse: !s.reverse }));
        return true;
      case 'map':
        setMapMode((m) => (m === 'sunburst' ? 'treemap' : m === 'treemap' ? 'off' : 'sunburst'));
        if (mapMode === 'treemap' && focus === 'map') setFocus('list');
        return true;
      case 'messages':
        openDialog('messages');
        return true;
      case 'theme':
        setThemeBefore(themeName);
        openDialog('theme');
        return true;
      case 'trash':
        if (!canTrash) {
          say('The Trash is not available here (no trash or osascript command); folders are deleted permanently.', 'warn');
          return true;
        }
        setUseTrash((v) => !v);
        say(useTrash ? 'Delete mode: items are removed permanently.' : 'Trash mode: deleted folders go to the Trash. Tool commands still run as usual.');
        return true;
      case 'clean':
        startClean();
        return true;
      case 'rescan':
        moveTo(0);
        scan.rescan();
        say('Rescanning…');
        return true;
      case 'help':
        setHelpQuery('');
        setHelpSearching(false);
        openDialog('help');
        return true;
      case 'quit':
        scan.abort();
        onExit();
        return true;
      case 'cancel':
        if (filter) setFilter('');
        return true;
    }
    return false;
  };

  const scrollDialog = (action: Action): boolean => {
    const steps: Partial<Record<Action, (o: number) => number>> = {
      down: (o) => o + 1,
      up: (o) => Math.max(0, o - 1),
      pageDown: (o) => o + pageRows,
      pageUp: (o) => Math.max(0, o - pageRows),
      top: () => 0,
      bottom: () => 100_000,
    };
    const step = steps[action];
    if (step) setDialogOffset(step);
    return Boolean(step);
  };

  const dispatch = (ctxName: Context, action: Action) => {
    const row = currentRow();
    switch (ctxName) {
      case 'welcome':
        setOverlay(null);
        onSaveState?.({ welcomed: true });
        return;
      case 'filter':
        if (action === 'confirm') setFiltering(false);
        if (action === 'cancel') {
          setFilter('');
          setFiltering(false);
        }
        return;
      case 'tools': {
        const tools = missingTools(selected);
        if (action === 'down') setToolCursor((c) => Math.min(tools.length, c + 1));
        if (action === 'up') setToolCursor((c) => Math.max(0, c - 1));
        if (action === 'toggle' && toolCursor === tools.length) setUninstallAfter((u) => !u);
        else if (action === 'toggle') {
          const bin = tools[toolCursor].bin;
          setInstall((s) => (s.has(bin) ? new Set([...s].filter((b) => b !== bin)) : new Set(s).add(bin)));
        }
        if (action === 'all') setInstall((s) => (s.size === tools.length ? new Set() : new Set(tools.map((t) => t.bin))));
        if (action === 'confirm') openDialog('review');
        if (action === 'cancel') setOverlay(null);
        return;
      }
      case 'review':
        if (scrollDialog(action)) return;
        if (action === 'confirm') runCleanup();
        if (action === 'cancel') setOverlay(null);
        return;
      case 'failure':
        if (action === 'retry' || action === 'skip' || action === 'skipAll' || action === 'abort') run.decide(action);
        return;
      case 'done':
        finishClean();
        return;
      case 'help':
        if (scrollDialog(action)) return;
        if (action === 'search') setHelpSearching(true);
        if (action === 'cancel') setOverlay(null);
        return;
      case 'helpSearch':
        if (action === 'cancel') {
          setHelpQuery('');
          setHelpSearching(false);
        }
        if (action === 'confirm') setHelpSearching(false);
        return;
      case 'messages':
        if (scrollDialog(action)) return;
        if (action === 'cancel') setOverlay(null);
        return;
      case 'sort':
        if (action === 'down') setSortCursor((c) => Math.min(SORT_KEYS.length - 1, c + 1));
        if (action === 'up') setSortCursor((c) => Math.max(0, c - 1));
        if (action === 'reverse') setSort((s) => ({ ...s, reverse: !s.reverse }));
        if (action === 'confirm') {
          setSort((s) => ({ ...s, key: SORT_KEYS[sortCursor].key }));
          setOverlay(null);
        }
        if (action === 'cancel') setOverlay(null);
        return;
      case 'theme': {
        const index = THEMES.findIndex((t) => t.name === themeName);
        if (action === 'down' || action === 'up') setThemeName(THEMES[Math.max(0, Math.min(THEMES.length - 1, index + (action === 'down' ? 1 : -1)))].name);
        if (action === 'confirm') {
          onSaveState?.({ theme: themeName });
          say(`Theme "${themeName}" saved.`);
          setOverlay(null);
        }
        if (action === 'cancel') {
          setThemeName(themeBefore);
          setOverlay(null);
        }
        return;
      }
      case 'preview':
        if (action === 'down') return setPreviewOffset((o) => Math.min(Math.max(0, previewLines.length - previewRows(previewHeight)), o + 1));
        if (action === 'up') return setPreviewOffset((o) => Math.max(0, o - 1));
        if (action === 'pageDown') return setPreviewOffset((o) => Math.min(Math.max(0, previewLines.length - previewRows(previewHeight)), o + previewRows(previewHeight)));
        if (action === 'pageUp') return setPreviewOffset((o) => Math.max(0, o - previewRows(previewHeight)));
        if (action === 'toggle') return browse ? toggle([browse.target]) : row && toggle(row.kind === 'target' ? [row.target] : row.targets);
        common(action);
        return;
      case 'map':
        if (action === 'next' || action === 'previous' || action === 'parent' || action === 'open') return mapStep(action);
        if (action === 'toggle') return browse ? toggle([browse.target]) : row && toggle(row.kind === 'target' ? [row.target] : row.targets);
        common(action);
        return;
      case 'files':
        if (!browse) return;
        if (action === 'down') return moveBrowse((c) => c + 1);
        if (action === 'up') return moveBrowse((c) => c - 1);
        if (action === 'pageDown') return moveBrowse((c) => c + listRows);
        if (action === 'pageUp') return moveBrowse((c) => c - listRows);
        if (action === 'top') return moveBrowse(() => 0);
        if (action === 'bottom') return moveBrowse(() => Number.MAX_SAFE_INTEGER);
        if (action === 'open') return enterEntry();
        if (action === 'parent') return browse.levels.length > 1 ? leaveDir() : closeFiles();
        if (action === 'back') return closeFiles();
        if (action === 'toggle') return toggle([browse.target]);
        common(action);
        return;
      case 'list': {
        const c = cursorRef.current;
        if (action === 'down') return moveTo(c + 1);
        if (action === 'up') return moveTo(c - 1);
        if (action === 'pageDown') return moveTo(c + listRows);
        if (action === 'pageUp') return moveTo(c - listRows);
        if (action === 'top') return moveTo(0);
        if (action === 'bottom') return moveTo(rows.length - 1);
        if (action === 'toggle' && row) {
          toggle(row.kind === 'target' ? [row.target] : row.targets);
          if (row.kind === 'target') moveTo(c + 1);
          return;
        }
        if ((action === 'expand' || action === 'open') && row) {
          if (row.kind === 'group' || row.kind === 'section') setCollapsed((s) => new Set([...s].filter((k) => k !== row.key)));
          if (row.kind === 'plugin') setExpanded((s) => new Set(s).add(row.key));
          if (row.kind === 'target' && action === 'open') openFiles(row.target);
          return;
        }
        if (action === 'collapse' && row) {
          if (row.kind === 'group' || row.kind === 'section') setCollapsed((s) => new Set(s).add(row.key));
          if (row.kind === 'plugin') setExpanded((s) => new Set([...s].filter((k) => k !== row.key)));
          if (row.kind === 'target') {
            setExpanded((s) => new Set([...s].filter((k) => k !== row.parent)));
            moveTo(rows.findIndex((r) => r.key === row.parent));
          }
          return;
        }
        if (action === 'all') {
          const visible = rows.flatMap((r) => (r.kind === 'target' ? [r.target] : []));
          return toggle(visible.length ? visible : groups.flatMap(([, plugins]) => plugins.flatMap(([, list]) => list)));
        }
        if (action === 'expandAll') return setExpanded((s) => (s.size ? new Set() : new Set(rows.filter((r) => r.kind === 'plugin').map((r) => r.key))));
        common(action);
        return;
      }
    }
  };

  const handleKey = (key: KeyEvent) => {
    const token = keyToken(key);
    const char = printable(key);
    if (context === 'filter' || context === 'helpSearch') {
      const action = resolve(context, token);
      if (action) return dispatch(context, action);
      const set = context === 'filter' ? setFilter : setHelpQuery;
      if (token === 'backspace' || token === 'delete') set((q) => q.slice(0, -1));
      else if (char) set((q) => q + char);
      if (context === 'filter') moveTo(0);
      else setDialogOffset(0);
      return;
    }
    const action = resolve(context, token);
    if (action) dispatch(context, action);
  };

  useKeyboard(handleKey);

  const browseEntry = browse ? currentEntry(browse) : undefined;
  const previewLines: Line[] = browse
    ? browseEntry
      ? [`${tildify(browseEntry.path)}  ·  ${human(browseEntry.size)}  ·  ${browseEntry.isDir ? 'folder, enter opens it' : 'file'}`, ...impactLines(browse.target, ctx.recentDays, minAge, theme), 'space selects or deselects the whole item; it is removed as one unit']
      : [...browse.target.commands.map((c) => `$ ${describeCommand(c)}`), ...browse.target.listed, ...impactLines(browse.target, ctx.recentDays, minAge, theme)]
    : preview;

  if (width < MIN_SIZE.width || height < MIN_SIZE.height) {
    return (
      <LookContext.Provider value={look}>
        <TooSmall screen={screen} />
      </LookContext.Provider>
    );
  }

  const activeKey = browse ? browseEntry?.path : current?.key;
  const mapRoot = browse ? browseMap(browse, colors.get(`t${browse.target.id}`) ?? theme.accent, theme.hues) : tree;
  const treemapFocus = browse ? mapRoot : (ancestry(tree, activeKey ?? '').slice(-2, -1)[0] ?? tree);
  const focusColor = modeColor(baseContext, theme);
  const mapHidden = mapMode !== 'off' && !showMap;
  const scanningShown = scan.scanning;

  const listEmpty = scan.scanning
    ? { message: 'Scanning for clutter…', detail: ctx.roots.map(tildify) }
    : filter
      ? { message: `No item matches “${filter}”.`, hint: { keys: 'esc', label: 'clear the filter' } }
      : { message: 'Nothing to clean here.', detail: [`Scanned ${ctx.roots.map(tildify).join(', ') || 'no folders'} and the known cache locations.`], hint: { keys: 'r', label: 'rescan' } };

  const reviewText = overlay === 'review' ? reviewLines(selected, { useTrash, trashAvailable: canTrash, install, uninstallAfter, hooks, minAge }, theme) : [];
  const help = overlay === 'help' ? helpLines(helpQuery, legendLines(ctx.recentDays, theme), theme) : [];

  return (
    <LookContext.Provider value={look}>
      <box flexDirection="column" width={width} height={height} backgroundColor={theme.name === 'dark' ? undefined : theme.panel}>
        <HeaderBar
          context={context}
          width={width}
          busy={scan.scanning || (overlay === 'progress' && !run.done)}
          segments={[
            { text: 'putzteufel', color: theme.accent, priority: 'optional', bold: true },
            { text: `${targets.length} found`, priority: 'essential' },
            { text: `${selected.length} selected`, priority: 'essential' },
            { text: `${human(uniqueSize(selected))} to free`, priority: 'normal' },
            { text: minAge ? `older than ${minAge}d` : 'any age', color: theme.accent, priority: 'essential' },
            { text: useTrash ? 'trash mode' : 'delete mode', color: useTrash ? theme.warn : theme.error, priority: 'normal' },
            ...(scanningShown ? [{ text: 'scanning…', color: theme.accent, priority: 'essential' as const }] : []),
            ...(mapHidden ? [{ text: `map needs ${MAP_MIN_WIDTH}+ columns, has ${width}`, color: theme.muted, priority: 'essential' as const }] : []),
          ]}
        />
        <box flexDirection="row" height={bodyHeight}>
          <box flexDirection="column" width={leftWidth}>
            {browse ? (
              <FilesPane browse={browse} width={leftWidth} height={listHeight} focused={paneFocus === 'list'} focusColor={focusColor} sortLabel={describeSort(sort)} owners={ownersOf} />
            ) : (
              <ListPane
                rows={rows}
                cursor={cursor}
                offset={offset}
                width={leftWidth}
                height={listHeight}
                focused={paneFocus === 'list'}
                focusColor={focusColor}
                colors={colors}
                highlights={highlights}
                young={young}
                shared={shared}
                bottomTitle={`${describeSort(sort)} · ${selected.length} selected · ${human(uniqueSize(selected))}`}
                empty={listEmpty}
              />
            )}
            <PreviewPane lines={previewLines} offset={previewOffset} width={leftWidth} height={previewHeight} focused={paneFocus === 'preview'} focusColor={focusColor} />
          </box>
          {showMap ? (
            <MapPane
              mode={mapMode === 'treemap' ? 'treemap' : 'sunburst'}
              root={mapRoot}
              treemapFocus={treemapFocus}
              activeKey={activeKey}
              depth={browse ? 1 : SUNBURST_DEPTH}
              width={mapWidth}
              height={bodyHeight}
              focused={paneFocus === 'map'}
              focusColor={focusColor}
              onPick={onMapPick}
            />
          ) : null}
        </box>
        <MessageBar messages={messages} width={width} />
        <Footer context={baseContext} width={width} prefix={filtering || filter ? `filter: ${filter}${filtering ? '▌' : ''}   ` : ''} />
        {overlay === 'welcome' ? <WelcomeDialog screen={screen} /> : null}
        {overlay === 'tools' ? <ToolsDialog screen={screen} tools={missingTools(selected)} selected={selected} install={install} cursor={toolCursor} uninstallAfter={uninstallAfter} /> : null}
        {overlay === 'review' ? <ReviewDialog screen={screen} lines={reviewText} offset={dialogOffset} /> : null}
        {overlay === 'progress' ? <ProgressDialog screen={screen} steps={run.steps} finishedOrder={run.finishedOrder} failure={run.failure} done={run.done} freed={run.freed} /> : null}
        {overlay === 'help' ? <HelpDialog screen={screen} lines={help} offset={dialogOffset} query={helpQuery} searching={helpSearching} /> : null}
        {overlay === 'messages' ? <MessagesDialog screen={screen} messages={messages} offset={dialogOffset} /> : null}
        {overlay === 'sort' ? <SortDialog screen={screen} sort={sort} cursor={sortCursor} /> : null}
        {overlay === 'theme' ? <ThemeDialog screen={screen} cursor={Math.max(0, THEMES.findIndex((t) => t.name === themeName))} /> : null}
      </box>
    </LookContext.Provider>
  );
}

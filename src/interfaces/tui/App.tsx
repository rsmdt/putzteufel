import type { KeyEvent } from '@opentui/core';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Hooks, type Plugin, type ScanContext, type Target, type Tool } from '../../domain/types.ts';
import { type Operation, logOperation } from '../../infrastructure/oplog.ts';
import { trashAvailable } from '../../infrastructure/remove.ts';
import { human } from '../../domain/format.ts';
import { isYounger, preselect } from '../../domain/impact.ts';
import { tildify } from '../../domain/paths.ts';
import { overlapIndex, uniqueSize } from '../../domain/overlap.ts';
import { type Estimate } from '../../domain/types.ts';
import { missingTools, stepsAffecting } from '../../domain/run-plan.ts';
import { toolSuggestions } from '../../domain/suggest.ts';
import { installTool } from '../../application/tools.ts';
import { Footer, HeaderBar, MessageBar, modeColor } from './components/Chrome.tsx';
import { createDispatch, type Focus, type Overlay } from './input/dispatch.ts';
import { type Action, type Context, keyToken, printable, resolve } from './keys.ts';
import { LookContext } from './look.ts';
import { ancestry } from './map/layout.ts';
import { browseMap, currentEntry, currentLevel } from './model/browse.ts';
import { type Line, legendLines, reviewLines } from './model/explain.ts';
import { runLogSteps, stepLines } from './model/log.ts';
import { type Level, type Message, message } from './model/messages.ts';
import { type Row, buildMap, buildRows, colorIndex, groupTargets, ownerLabel, sectionKey } from './model/rows.ts';
import { DEFAULT_SORT, type Sort, describeSort } from '../../domain/sort.ts';
import { useBrowse } from './state/useBrowse.ts';
import { useCleanRun } from './state/useCleanRun.ts';
import { useExactFreed } from './state/useExactFreed.ts';
import { usePreview } from './state/usePreview.ts';
import { useScan } from './state/useScan.ts';
import { ICONS, type IconSet, THEMES, themeNamed } from './theme.ts';
import { HelpDialog, helpLines } from './views/dialogs/Help.tsx';
import { ReviewDialog } from './views/dialogs/Review.tsx';
import { dialogRows } from './views/dialogs/shared.tsx';
import { SortDialog } from './views/dialogs/Sort.tsx';
import { ThemeDialog } from './views/dialogs/Theme.tsx';
import { MIN_SIZE, TooSmall } from './views/dialogs/TooSmall.tsx';
import { ToolsDialog } from './views/dialogs/Tools.tsx';
import { WelcomeDialog } from './views/dialogs/Welcome.tsx';
import { useTicker } from './hooks.ts';
import { FilesPane } from './views/FilesPane.tsx';
import { type Busy, ListPane } from './views/ListPane.tsx';
import { MAP_MIN_WIDTH, MapPane, type MapMode } from './views/MapPane.tsx';
import { PreviewPane, previewRows } from './views/PreviewPane.tsx';

const AGE_STEPS = [0, 1, 3, 7, 14, 30, 60, 90, 180, 365];
const SUNBURST_DEPTH = 3;
const LOCKED_WHILE_CLEANING = new Set<Action>(['toggle', 'all', 'ageUp', 'ageDown', 'clean', 'rescan', 'install', 'trash', 'quit']);

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
  estimates?: Map<string, Estimate>;
  onScanned?: (targets: Target[]) => void;
  onExit: () => void;
}

export function App({ plugins, ctx, configErrors = [], hooks = {}, icons = 'unicode', theme: initialTheme, firstRun = false, onSaveState, onOperation = logOperation, estimates, onScanned, onExit }: AppProps) {
  const { width, height } = useTerminalDimensions();
  const [latest, setLatest] = useState<Message | undefined>(configErrors.length ? message(configErrors.join(' · '), 'error') : undefined);
  const say = (text: string, level: Level = 'info') => setLatest(message(text, level));
  const minAgeRef = useRef(ctx.olderThan);
  const [minAge, setMinAge] = useState(ctx.olderThan);
  const scan = useScan(plugins, ctx, minAgeRef, (text) => say(text, 'warn'), { estimates, onScanned });
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
  const [installedHere, setInstalledHere] = useState<Tool[]>([]);
  const [uninstallLater, setUninstallLater] = useState(false);
  const [installing, setInstalling] = useState(false);
  const announced = useRef(new Set<string>());
  const [dialogOffset, setDialogOffset] = useState(0);
  const [helpQuery, setHelpQuery] = useState('');
  const [helpSearching, setHelpSearching] = useState(false);
  const [previewOffset, setPreviewOffset] = useState(0);

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
  const browser = useBrowse(sort, listRows);
  const { browse } = browser;

  const targets = scan.targets.current;
  const scanningPlugins = new Set(scan.progress.running.filter((a) => a.kind === 'scan' && a.plugins.length === 1).flatMap((a) => a.plugins));
  const projectWalk = scan.progress.running.find((a) => a.kind === 'scan' && a.plugins.length > 1);
  const measuringTargets = new Set(scan.progress.running.flatMap((a) => (a.targetId === undefined ? [] : [a.targetId])));
  const withTargets = new Set(targets.map((t) => t.plugin));
  const pending = scan.progress.running.flatMap((a) => (a.kind === 'scan' && a.group && !withTargets.has(a.plugins[0]) ? [{ plugin: a.plugins[0], group: a.group }] : []));
  const pendingPlugins = pending.map((p) => p.plugin).join('|');
  const { groups, highlights } = useMemo(() => groupTargets(targets, filter, sort, pending), [scan.version, filter, sort, pendingPlugins]);
  const rows = useMemo(() => buildRows(groups, filter, collapsed, expanded), [groups, collapsed, expanded]);
  const overlap = useMemo(() => overlapIndex(targets), [scan.version]);
  const tree = useMemo(() => buildMap(groups, theme.hues, new Map(targets.flatMap((t) => { const by = overlap.coveredBy(t); return by ? [[t.id, by] as [number, Target]] : []; }))), [groups, theme, overlap]);
  const colors = useMemo(() => colorIndex(tree), [tree]);
  const current = rows[Math.min(cursor, rows.length - 1)];
  if (cursor < offsetRef.current) offsetRef.current = cursor;
  else if (cursor >= offsetRef.current + listRows) offsetRef.current = cursor - listRows + 1;
  const offset = offsetRef.current;
  const selected = targets.filter((t) => t.selected);
  const suggestions = useMemo(() => toolSuggestions(targets), [scan.version]);
  const descriptions = useMemo(() => new Map(plugins.map((p) => [p.name, p.description ?? ''])), [plugins]);
  const young = (t: Target) => isYounger(t, ctx.recentDays, minAge);
  const shared = (t: Target) => [...new Set(overlap.sharedWith(t).map(ownerLabel))];
  const ownersOf = (p: string) => (browse ? [...new Set(overlap.owners(p).filter((t) => t.id !== browse.target.id).map(ownerLabel))] : []);
  const exact = useExactFreed(overlay === 'review', selected);
  const targetBusy = (t: Target): Busy => {
    const cleaning = run.active ? run.stepFor(t.id)?.state : undefined;
    if (cleaning === 'running' || measuringTargets.has(t.id)) return 'active';
    if (cleaning === 'pending' || (scan.scanning && !scan.measured.current.has(t.id))) return 'waiting';
    return undefined;
  };
  const combine = (states: Busy[]): Busy => (states.includes('active') ? 'active' : states.includes('waiting') ? 'waiting' : undefined);
  const pluginBusy = (name: string, list: Target[]): Busy => (scanningPlugins.has(name) ? 'active' : combine(list.map(targetBusy)));
  const rowBusy = (row: Row): Busy => {
    if (row.kind === 'target') return targetBusy(row.target);
    if (row.kind === 'plugin') return pluginBusy(row.name, row.targets);
    const groupsOf = row.kind === 'section' ? groups.filter(([g]) => sectionKey(g) === row.key) : groups.filter(([g]) => g === row.name);
    return combine(groupsOf.flatMap(([, plugins]) => plugins.map(([name, list]) => pluginBusy(name, list))));
  };
  const hasRunSteps = (row: Row) => (row.kind === 'target' ? [row.target] : row.kind === 'plugin' ? row.targets : []).some((t) => run.stepFor(t.id));
  const spinnerFrame = useTicker(scan.scanning || run.active);
  const spinner = look.icons.spinner[spinnerFrame % look.icons.spinner.length];
  const logLines = (row?: Row): Line[] => {
    if (!row || row.kind === 'section' || row.kind === 'group') return [];
    const scanned = row.kind === 'plugin' ? scan.stepsFor(row.name) : scan.stepsFor(row.target.plugin, row.target.id);
    const cleaning = runLogSteps(stepsAffecting(run.steps, row.kind === 'plugin' ? row.targets : [row.target]));
    return stepLines([...scanned, ...cleaning], spinner, look.icons, theme);
  };
  const preview = usePreview({ row: current, browse, descriptions, recentDays: ctx.recentDays, minAge, theme, overlap, log: logLines(current), version: scan.version });

  const overlayContext = (): Context | null => {
    if (!overlay) return null;
    if (overlay === 'help') return helpSearching ? 'helpSearch' : 'help';
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

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, index));
    cursorRef.current = next;
    setCursor(next);
  };

  const cleaned = (t: Target) => run.stepFor(t.id)?.state === 'done';

  const toggle = (all: Target[]) => {
    const list = all.filter((t) => !cleaned(t));
    const value = !list.every((t) => t.selected);
    list.forEach((t) => {
      t.selected = value;
      t.touched = true;
    });
    scan.bump();
  };

  const stepAge = (direction: 1 | -1) => {
    const age = minAgeRef.current;
    const index = AGE_STEPS.findIndex((d) => d >= age);
    const from = index < 0 ? AGE_STEPS.length - 1 : AGE_STEPS[index] === age ? index : direction > 0 ? index - 1 : index;
    const days = AGE_STEPS[Math.max(0, Math.min(AGE_STEPS.length - 1, from + direction))];
    minAgeRef.current = days;
    setMinAge(days);
    for (const t of scan.targets.current) if (t.ageDays !== undefined && !cleaned(t)) t.selected = preselect(t, ctx.recentDays, days);
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
    browser.open(target);
    setFocus('list');
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
    setOverlay(null);
    browser.close();
    setFocus('list');
    const plugins = new Set(targetsToClean.map((t) => t.plugin));
    const rowsToOpen = groups.flatMap(([category, list]) => list.filter(([plugin]) => plugins.has(plugin)).map(([plugin]) => ({ category, key: `${category}/${plugin}` })));
    setCollapsed((s) => new Set([...s].filter((k) => !rowsToOpen.some((r) => k === r.category || k === sectionKey(r.category)))));
    setExpanded((s) => new Set([...s, ...rowsToOpen.map((r) => r.key)]));
    if (targetsToClean[0]) setPendingKey(`t${targetsToClean[0].id}`);
    const earlier = uninstallLater ? installedHere : [];
    say(`Cleaning ${targetsToClean.length} item(s). esc stops it: a folder being deleted stops at its next entry, a command is killed.`);
    run.start({ targets: targetsToClean, install: missingTools(targetsToClean).filter((t) => install.has(t.bin)), installedEarlier: earlier, uninstallAfter, hooks, useTrash, trashAvailable: canTrash, minAge: minAgeRef.current }, (result) => {
      for (const t of targetsToClean) if (result.cleaned.has(t.id)) t.selected = false;
      scan.bump();
      const removed = new Set(result.steps.filter((s) => s.kind === 'uninstall' && s.state === 'done').map((s) => s.id.slice('uninstall:'.length)));
      setInstalledHere((tools) => tools.filter((t) => !removed.has(t.bin)));
      const failed = result.steps.filter((s) => s.state === 'failed').length;
      say(`Cleaned ${result.cleaned.size} of ${targetsToClean.length} item(s), freed about ${human(result.freed)}${failed ? `, ${failed} step(s) failed` : ''}${result.aborted ? ', aborted' : ''}${result.error ? `; stopped by an error: ${result.error}` : ''}.`, result.error ? 'error' : failed || result.aborted ? 'warn' : 'info');
    });
  };

  useEffect(() => {
    for (const s of suggestions) {
      if (announced.current.has(s.tool.bin)) continue;
      announced.current.add(s.tool.bin);
      say(`Suggested: ${s.reason}. Press i to install it.`);
    }
  }, [suggestions]);

  const openSuggestions = () => {
    if (!suggestions.length) return say(scan.scanning ? 'No tool suggestions yet; the scan is still running.' : 'No tool suggestions: every native tool putzteufel could use is installed or has no install command.');
    setInstall(new Set(suggestions.map((s) => s.tool.bin)));
    setToolCursor(0);
    setUninstallAfter(false);
    openDialog('suggest');
  };

  const installNow = async () => {
    const chosen = suggestions.map((s) => s.tool).filter((t) => install.has(t.bin));
    setOverlay(null);
    if (!chosen.length) return;
    setUninstallLater(uninstallAfter);
    setInstalling(true);
    const added: Tool[] = [];
    for (const tool of chosen) {
      say(`Installing ${tool.bin}: ${tool.install}`);
      const outcome = await installTool(tool);
      if (outcome.ok) added.push(tool);
      say(outcome.ok ? `Installed ${tool.bin}; its items are rescanned to use it.` : `Could not install ${tool.bin}: ${outcome.error}`, outcome.ok ? 'info' : 'error');
    }
    setInstalling(false);
    setUninstallAfter(true);
    if (!added.length) return;
    setInstalledHere((tools) => [...tools, ...added.filter((a) => !tools.some((t) => t.bin === a.bin))]);
    run.reset();
    scan.rescan();
  };

  const focusOrder: Focus[] = showMap ? ['list', 'preview', 'map'] : ['list', 'preview'];
  const cycleFocus = (step: 1 | -1) => setFocus(focusOrder[(focusOrder.indexOf(paneFocus) + step + focusOrder.length) % focusOrder.length]);

  const dispatch = createDispatch({
    rows,
    groups,
    tree,
    cursor: () => cursorRef.current,
    moveTo,
    listRows,
    pageRows,
    previewPage: previewRows(previewHeight),
    previewMax: Math.max(0, preview.lines.length - previewRows(previewHeight)),
    toggle,
    reveal,
    browser,
    openFiles,
    stepAge,
    cycleFocus,
    focus,
    setFocus,
    filter,
    setFilter,
    setFiltering,
    setCollapsed,
    setExpanded,
    sort,
    setSort,
    sortCursor,
    setSortCursor,
    mapMode,
    setMapMode,
    openDialog,
    closeDialog: () => setOverlay(null),
    setDialogOffset,
    setPreviewOffset,
    themeName,
    setThemeName,
    themeBefore,
    setThemeBefore,
    toggleTrash: () => {
      if (!canTrash) return say('The Trash is not available here (no trash or osascript command); folders are deleted permanently.', 'warn');
      setUseTrash((v) => !v);
      say(useTrash ? 'Delete mode: items are removed permanently.' : 'Trash mode: deleted folders go to the Trash. Tool commands still run as usual.');
    },
    startClean,
    runCleanup,
    rescan: () => {
      moveTo(0);
      run.reset();
      scan.rescan();
      say('Rescanning…');
    },
    openHelp: () => {
      setHelpQuery('');
      setHelpSearching(false);
      openDialog('help');
    },
    setHelpSearching,
    setHelpQuery,
    tools: missingTools(selected),
    suggestedTools: suggestions.map((s) => s.tool),
    openSuggestions,
    installNow: () => void installNow(),
    toolCursor,
    setToolCursor,
    setInstall,
    setUninstallAfter,
    saveState: (patch) => onSaveState?.(patch),
    say: (text) => say(text),
    quit: () => {
      scan.abort();
      run.abort();
      onExit();
    },
  });

  const onMapPick = (key: string | 'center') => {
    if (key === 'center') return dispatch('map', 'parent');
    if (!browse) return reveal(key);
    const level = currentLevel(browse);
    const index = (level.entries ?? []).findIndex((e) => e.path === key);
    if (index < 0) return;
    if (index === level.cursor && level.entries![index].isDir) return browser.enterEntry();
    browser.move(() => index);
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
    if (!action) return;
    if (run.active && !overlay) {
      if (action === 'cancel') {
        run.abort();
        return say('Stopping the cleanup: the running command is killed, a folder being deleted stops at its next entry…', 'warn');
      }
      if (LOCKED_WHILE_CLEANING.has(action)) return say(`A cleanup is running. Wait for it to finish, or press esc to stop it${action === 'quit' ? ' first, so putzteufel can still uninstall its tools and run your after hook' : ''}.`, 'warn');
    }
    dispatch(context, action);
  };

  useKeyboard(handleKey);

  const browseEntry = browse ? currentEntry(browse) : undefined;

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
  const items = run.steps.filter((s) => s.kind === 'item');
  const finishedItems = items.filter((s) => s.state === 'done' || s.state === 'failed' || s.state === 'skipped').length;
  const freed = items.reduce((n, s) => n + (s.state === 'done' ? (s.bytes ?? 0) : 0), 0);
  const cleaning = run.active ? `cleaning ${finishedItems}/${items.length} · ${human(freed)} freed` : '';

  const listEmpty = scan.scanning
    ? { message: 'Scanning for clutter…', detail: ctx.roots.map(tildify) }
    : filter
      ? { message: `No item matches “${filter}”.`, hint: { keys: 'esc', label: 'clear the filter' } }
      : { message: 'Nothing to clean here.', detail: [`Scanned ${ctx.roots.map(tildify).join(', ') || 'no folders'} and the known cache locations.`], hint: { keys: 'r', label: 'rescan' } };

  const reviewText = overlay === 'review' ? reviewLines(selected, { useTrash, trashAvailable: canTrash, install, uninstallAfter, hooks, minAge, exact, installedEarlier: uninstallLater ? installedHere : [] }, theme) : [];
  const help = overlay === 'help' ? helpLines(helpQuery, legendLines(ctx.recentDays, theme), theme) : [];

  return (
    <LookContext.Provider value={look}>
      <box flexDirection="column" width={width} height={height} backgroundColor={theme.name === 'dark' ? undefined : theme.panel}>
        <HeaderBar
          context={context}
          width={width}
          busy={scan.scanning || installing || run.active}
          mode={run.active && !overlay ? (run.stopping ? 'STOPPING' : 'CLEANING') : undefined}
          segments={[
            { text: 'putzteufel', color: theme.accent, priority: 'optional', bold: true },
            { text: `${targets.length} found`, priority: 'essential' },
            { text: `${selected.length} selected`, priority: 'essential' },
            { text: `${selected.some((t) => t.estimated || t.size === undefined) ? '≈' : ''}${human(uniqueSize(selected))} to free`, priority: 'normal' },
            { text: minAge ? `older than ${minAge}d` : 'any age', color: theme.accent, priority: 'essential' },
            { text: useTrash ? 'trash mode' : 'delete mode', color: useTrash ? theme.warn : theme.error, priority: 'normal' },
            ...(scanningShown ? [{ text: `scanning: ${scan.progress.running.length} running, ${scan.progress.waiting} waiting`, color: theme.accent, priority: 'essential' as const }] : []),
            ...(projectWalk ? [{ text: `projects: ${projectWalk.detail?.split(';')[0] ?? 'starting'}`, color: theme.accent, priority: 'normal' as const }] : []),
            ...(cleaning ? [{ text: cleaning, color: run.stopping ? theme.warn : theme.accent, priority: 'essential' as const }] : []),
            ...(installing ? [{ text: 'installing tools…', color: theme.warn, priority: 'essential' as const }] : []),
            ...(suggestions.length && !installing ? [{ text: `${suggestions.length} tool suggestion${suggestions.length > 1 ? 's' : ''} (i)`, color: theme.warn, priority: 'essential' as const }] : []),
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
                busy={rowBusy}
                runStep={(t) => run.stepFor(t.id)}
                spinner={spinner}
                frame={spinnerFrame}
                bottomTitle={`${describeSort(sort)} · ${selected.length} selected · ${human(uniqueSize(selected))}`}
                empty={listEmpty}
              />
            )}
            <PreviewPane lines={preview.lines} offset={previewOffset} width={leftWidth} height={previewHeight} focused={paneFocus === 'preview'} focusColor={focusColor} followTo={current && (rowBusy(current) !== undefined || hasRunSteps(current)) ? preview.logEnd : undefined} />
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
        <MessageBar message={latest} width={width} />
        <Footer context={baseContext} width={width} prefix={`${run.active ? `${cleaning} · esc stops   ` : ''}${filtering || filter ? `filter: ${filter}${filtering ? '▌' : ''}   ` : ''}`} />
        {overlay === 'welcome' ? <WelcomeDialog screen={screen} /> : null}
        {overlay === 'tools' ? <ToolsDialog screen={screen} context="tools" tools={missingTools(selected)} items={selected} install={install} cursor={toolCursor} uninstallAfter={uninstallAfter} /> : null}
        {overlay === 'suggest' ? <ToolsDialog screen={screen} context="suggest" tools={suggestions.map((s) => s.tool)} items={targets} install={install} cursor={toolCursor} uninstallAfter={uninstallAfter} /> : null}
        {overlay === 'review' ? <ReviewDialog screen={screen} lines={reviewText} offset={dialogOffset} /> : null}
        {overlay === 'help' ? <HelpDialog screen={screen} lines={help} offset={dialogOffset} query={helpQuery} searching={helpSearching} /> : null}
        {overlay === 'sort' ? <SortDialog screen={screen} sort={sort} cursor={sortCursor} /> : null}
        {overlay === 'theme' ? <ThemeDialog screen={screen} cursor={Math.max(0, THEMES.findIndex((t) => t.name === themeName))} /> : null}
      </box>
    </LookContext.Provider>
  );
}

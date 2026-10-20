import path from 'node:path';
import type { BoxRenderable, KeyEvent, MouseEvent } from '@opentui/core';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { type Entry, type Hooks, IMPACTS, IMPACT_ORDER, type Plugin, type ScanContext, type Target, describeCommand, dirEntries, entrySizes, human, isRecent, isYounger, listing, preselect, tildify } from './core.ts';
import { type Cell, type MapNode, ancestry, arcAtPixel, categoryColor, fit, rectAt, renderSunburst, renderTreemap, sunburstArcs, sunburstGeometry, toRuns, treemapRects } from './diskmap.ts';
import { actionFor, missingTools, runClean } from './run.ts';
import { scanAll } from './scan.ts';

type Row =
  | { kind: 'category'; key: string; name: string; targets: Target[] }
  | { kind: 'plugin'; key: string; name: string; targets: Target[] }
  | { kind: 'target'; key: string; target: Target; parent: string };

type View = 'list' | 'files' | 'tools' | 'confirm' | 'clean' | 'help';
type Line = string | { text: string; fg?: string };
type MapMode = 'sunburst' | 'treemap' | 'off';

interface Browse {
  target: Target;
  dirs: string[];
  entries: Entry[] | null;
  cursor: number;
  offset: number;
}

export interface AppProps {
  plugins: Plugin[];
  ctx: Omit<ScanContext, 'signal'>;
  configErrors?: string[];
  hooks?: Hooks;
  onExit: () => void;
}

export const AGE_STEPS = [0, 1, 3, 7, 14, 30, 60, 90, 180, 365];
const SUNBURST_DEPTH = 3;
const ACTIVE_BG = '#2f3646';
const MUTED = '#808080';

const sum = (targets: Target[]) => targets.reduce((n, t) => n + (t.size ?? 0), 0);

function box(targets: Target[]): string {
  const selected = targets.filter((t) => t.selected).length;
  return selected === 0 ? '[ ]' : selected === targets.length ? '[x]' : '[-]';
}

function stats(targets: Target[]): string {
  const selected = targets.filter((t) => t.selected);
  return `${selected.length}/${targets.length} · ${human(sum(selected))} of ${human(sum(targets))}`;
}

function matches(t: Target, filter: string): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return [t.label, t.plugin, t.category, ...t.paths].some((s) => s.toLowerCase().includes(needle));
}

type Groups = [string, [string, Target[]][]][];

function groupTargets(targets: Target[], filter: string): Groups {
  const categories = new Map<string, Map<string, Target[]>>();
  for (const t of targets.filter((t) => matches(t, filter))) {
    const plugins = categories.get(t.category) ?? new Map<string, Target[]>();
    categories.set(t.category, plugins);
    plugins.set(t.plugin, [...(plugins.get(t.plugin) ?? []), t]);
  }
  return [...categories.entries()]
    .sort(([a, pa], [b, pb]) => (a === 'Projects' ? -1 : b === 'Projects' ? 1 : sum([...pb.values()].flat()) - sum([...pa.values()].flat())))
    .map(([category, plugins]) => [
      category,
      [...plugins.entries()].sort(([, a], [, b]) => sum(b) - sum(a)).map(([plugin, list]) => [plugin, [...list].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))] as [string, Target[]]),
    ]);
}

function buildRows(groups: Groups, filter: string, collapsed: Set<string>, expanded: Set<string>): Row[] {
  const rows: Row[] = [];
  for (const [category, plugins] of groups) {
    rows.push({ kind: 'category', key: category, name: category, targets: plugins.flatMap(([, list]) => list) });
    if (collapsed.has(category)) continue;
    for (const [plugin, list] of plugins) {
      const key = `${category}/${plugin}`;
      rows.push({ kind: 'plugin', key, name: plugin, targets: list });
      if (!expanded.has(key) && !filter) continue;
      for (const target of list) rows.push({ kind: 'target', key: `t${target.id}`, target, parent: key });
    }
  }
  return rows;
}

function buildMap(groups: Groups): MapNode {
  const categories = groups.map(([category, plugins], ci) => {
    const pluginNodes = plugins.map(([plugin, list], pi) => {
      const targetNodes = list.map((t, ti) => ({
        key: `t${t.id}`,
        label: tildify(t.label),
        size: t.size ?? 0,
        color: categoryColor(ci, 2, ti),
        dim: !t.selected,
        children: [],
      }));
      return { key: `${category}/${plugin}`, label: plugin, size: sum(list), color: categoryColor(ci, 1, pi), dim: !list.some((t) => t.selected), children: targetNodes };
    });
    const all = plugins.flatMap(([, list]) => list);
    return { key: category, label: category, size: sum(all), color: categoryColor(ci, 0, 0), dim: !all.some((t) => t.selected), children: pluginNodes };
  });
  return { key: 'root', label: 'Everything', size: categories.reduce((n, c) => n + c.size, 0), color: '#ffffff', dim: false, children: categories };
}

function colorIndex(root: MapNode): Map<string, string> {
  const colors = new Map<string, string>();
  const visit = (n: MapNode) => {
    colors.set(n.key, n.color);
    n.children.forEach(visit);
  };
  visit(root);
  return colors;
}

const entryColor = (index: number) => categoryColor(index, 1, index);

function filesMap(browse: Browse, color: string): MapNode {
  const entries = browse.entries ?? [];
  const children = entries.map((e, i) => ({ key: e.path, label: e.name, size: e.size, color: entryColor(i), dim: !browse.target.selected, children: [] }));
  const label = browse.dirs.length ? path.basename(browse.dirs[browse.dirs.length - 1]) : path.basename(browse.target.label);
  return { key: 'files', label, size: entries.reduce((n, e) => n + e.size, 0), color, dim: false, children };
}

function targetDetail(t: Target): string {
  const relative = t.paths.map((p) => path.relative(t.label, p)).filter((r) => r && !r.startsWith('..'));
  if (relative.length) return relative.join(', ');
  if (t.tool && !t.tool.installed && t.tool.clean.length) return t.tool.broken ? `${t.tool.bin} failed` : `${t.tool.bin} not installed`;
  if (t.commands.length) return `via ${t.commands[0].run}`;
  return '';
}

function toolLines(t: Target): Line[] {
  if (!t.tool?.clean.length) return t.commands.length ? [`Cleaned by: $ ${describeCommand(t.commands[0])}`] : ['Cleaned by deleting the files listed below.'];
  if (t.tool.installed) return [`Cleaned by its own tool: $ ${describeCommand(t.tool.clean[0])}`];
  if (t.tool.broken) return [{ text: `${t.tool.bin} is installed but failed (${t.tool.broken}): its default folders are deleted directly.`, fg: 'yellow' }];
  return [
    { text: `${t.tool.bin} is not installed: the folders are deleted directly.`, fg: 'yellow' },
    ...(t.tool.install ? [{ text: `d offers to install it first (${t.tool.install}) and clean with $ ${t.tool.clean[0].run}`, fg: 'yellow' }] : []),
  ];
}

function ImpactTag({ target }: { target: Target }) {
  const info = IMPACTS[target.impact];
  return <span fg={info.color}>{` ${info.tag}`}</span>;
}

function impactLines(t: Target, recentDays: number, minAge: number): Line[] {
  const info = IMPACTS[t.impact];
  const lines: Line[] = [{ text: `If removed (${info.tag}): ${info.meaning}`, fg: info.color }];
  if (t.note) lines.push({ text: `  ${t.note}`, fg: info.color });
  if (!info.preselected) lines.push(`Not selected by default: ${info.tag} items are only removed when you pick them. ? explains the tags.`);
  else if (t.project !== undefined && isRecent(t, recentDays)) lines.push(`Not selected by default: the project was edited in the last ${recentDays} days.`);
  else if (isRecent(t, minAge)) lines.push(`Not selected by default: younger than the ${minAge}-day age threshold.`);
  else lines.push(`Selected by default: ${info.tag} items are recreated without losing anything.`);
  return lines;
}

function helpLines(recentDays: number): Line[] {
  return [
    'What the tags mean: what happens to an item after it is removed.',
    '',
    ...IMPACT_ORDER.flatMap((impact): Line[] => {
      const info = IMPACTS[impact];
      return [{ text: `${info.tag.padEnd(12)} ${info.meaning}`, fg: info.color }, `${''.padEnd(12)} ${info.preselected ? 'Selected by default.' : 'Never selected by default.'}`];
    }),
    '',
    { text: `${'recent'.padEnd(12)} A project edited in the last ${recentDays} days, or an item younger than the [ ] age threshold.`, fg: 'cyan' },
    `${''.padEnd(12)} Never selected by default.`,
    '',
    'The preview under the list explains the item at the cursor. Press f to see every file before you decide.',
    'Nothing is removed until d shows the review screen and you press y.',
    '',
    'Any key closes this help.',
  ];
}

function Swatch({ color }: { color?: string }) {
  return <span fg={color ?? MUTED}>● </span>;
}

function RowLine({ row, active, young, width, color }: { row: Row; active: boolean; young: (t: Target) => boolean; width: number; color?: string }) {
  const bg = active ? ACTIVE_BG : undefined;
  if (row.kind === 'category') {
    return (
      <text bg={bg} wrapMode="none">
        <Swatch color={color} />
        <strong>{fit(row.name, width - 30)}</strong>
        <span fg={MUTED}>{`  ${stats(row.targets)}`}</span>
      </text>
    );
  }
  if (row.kind === 'plugin') {
    return (
      <text bg={bg} wrapMode="none">
        {'  '}
        <Swatch color={color} />
        {`${box(row.targets)} ${fit(row.name, width - 48)}`}
        <span fg={MUTED}>{`  ${stats(row.targets)}`}</span>
        {row.targets[0] ? <ImpactTag target={row.targets[0]} /> : null}
      </text>
    );
  }
  const t = row.target;
  const age = t.ageDays === undefined ? '' : `${Math.floor(t.ageDays)}d`;
  const tags = ` ${IMPACTS[t.impact].tag}${young(t) ? ' recent' : ''}`;
  const head = `${t.selected ? '[x]' : '[ ]'} ${human(t.size).padStart(7)} ${age.padStart(5)}  `;
  const detail = targetDetail(t);
  const room = Math.max(8, width - 8 - head.length - tags.length - Math.min(detail.length, 24) - 2);
  return (
    <text bg={bg} fg={t.selected ? undefined : MUTED} wrapMode="none">
      {'    '}
      <Swatch color={color} />
      {head}
      {fit(tildify(t.label), room)}
      <span fg={MUTED}>{detail ? `  ${fit(detail, 24)}` : ''}</span>
      <ImpactTag target={t} />
      {young(t) ? <span fg="cyan"> recent</span> : null}
    </text>
  );
}

function confirmLines(selected: Target[], useTrash: boolean, install: Set<string>, uninstallAfter: boolean, hooks: Hooks): Line[] {
  const lines: Line[] = [
    `${useTrash ? 'Move to Trash' : 'Permanently delete'} ${selected.length} item(s), about ${human(sum(selected))}.`,
    'Items with a $ line run that tool command instead of deleting files. Press f on an item in the list to browse its files.',
  ];
  const tools = missingTools(selected).filter((t) => install.has(t.bin));
  const steps: Line[] = [
    ...(hooks.before ? [`  before hook:  $ ${hooks.before}`] : []),
    ...tools.map((t) => ({ text: `  install:      $ ${t.install}`, fg: 'yellow' })),
    ...(uninstallAfter ? tools.filter((t) => t.uninstall).map((t) => ({ text: `  then remove:  $ ${t.uninstall}  (after cleaning; dependencies brew pulled in stay)`, fg: 'yellow' })) : []),
    ...(hooks.after ? [`  after hook:   $ ${hooks.after}`] : []),
  ];
  if (steps.length) lines.push('', 'Run steps:', ...steps);
  for (const impact of IMPACT_ORDER) {
    const group = selected.filter((t) => t.impact === impact);
    if (group.length) lines.push({ text: `  ${String(group.length).padStart(4)} ${IMPACTS[impact].tag.padEnd(12)} ${human(sum(group)).padStart(7)}  ${IMPACTS[impact].meaning}`, fg: IMPACTS[impact].color });
  }
  if (selected.some((t) => t.impact === 'dataloss')) lines.push({ text: 'Data loss items cannot be recovered. Check them below before pressing y.', fg: IMPACTS.dataloss.color });
  lines.push('');
  for (const t of [...selected].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))) {
    lines.push({ text: `${human(t.size).padStart(7)}  ${IMPACTS[t.impact].tag.padEnd(12)} [${t.plugin}] ${tildify(t.label)}`, fg: t.impact === 'regenerates' || t.impact === 'rebuild' ? undefined : IMPACTS[t.impact].color });
    const action = actionFor(t, install);
    if (t.hooks?.before) lines.push(`           before: $ ${t.hooks.before}`);
    if (action.kind === 'commands') for (const c of action.commands) lines.push(`           $ ${describeCommand(c)}${action.afterInstall ? '   (after install)' : ''}`);
    else {
      if (action.missing) lines.push({ text: `           ${action.missing} not installed: the folders below are deleted directly`, fg: 'yellow' });
      for (const p of t.paths) if (p !== t.label || action.missing) lines.push(`           - ${tildify(p)}`);
    }
    if (t.hooks?.after) lines.push(`           after:  $ ${t.hooks.after}`);
    for (const l of t.listed) lines.push(`           · ${l}`);
  }
  return lines;
}

function LineText({ line, width, fg }: { line: Line; width: number; fg?: string }) {
  const { text, fg: own } = typeof line === 'string' ? { text: line, fg: undefined } : line;
  return (
    <text wrapMode="none" fg={own ?? fg}>
      {fit(text, width)}
    </text>
  );
}

function CellRows({ grid }: { grid: Cell[][] }) {
  return (
    <>
      {grid.map((row, y) => (
        <text key={y} wrapMode="none">
          {toRuns(row).map((run, i) => (
            <span key={i} fg={run.fg} bg={run.bg}>
              {run.text}
            </span>
          ))}
        </text>
      ))}
    </>
  );
}

export function App({ plugins, ctx, configErrors = [], hooks = {}, onExit }: AppProps) {
  const { width, height } = useTerminalDimensions();
  const targetsRef = useRef<Target[]>([]);
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const [generation, setGeneration] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [errors, setErrors] = useState<string[]>(configErrors);
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const offsetRef = useRef(0);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [expanded, setExpanded] = useState(new Set<string>());
  const [filter, setFilter] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [useTrash, setUseTrash] = useState(false);
  const [view, setView] = useState<View>('list');
  const [mapMode, setMapMode] = useState<MapMode>('sunburst');
  const [minAge, setMinAge] = useState(ctx.olderThan);
  const minAgeRef = useRef(ctx.olderThan);
  const [browse, setBrowse] = useState<Browse | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmOffset, setConfirmOffset] = useState(0);
  const [install, setInstall] = useState(new Set<string>());
  const [uninstallAfter, setUninstallAfter] = useState(true);
  const [toolCursor, setToolCursor] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [cleanDone, setCleanDone] = useState(false);
  const [preview, setPreview] = useState<Line[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const cleanedRef = useRef<Set<number>>(new Set());
  const mapRef = useRef<BoxRenderable>(null);

  const bodyHeight = Math.max(6, height - 2);
  const showMap = mapMode !== 'off' && width >= 90;
  const mapWidth = showMap ? Math.floor(width * 0.42) : 0;
  const listWidth = width - mapWidth;
  const previewHeight = Math.max(4, Math.floor(bodyHeight * 0.3));
  const listHeight = Math.max(3, bodyHeight - previewHeight);
  const mapInner = { w: Math.max(4, mapWidth - 2), h: Math.max(2, bodyHeight - 2) };

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const buffer: Target[] = [];
    targetsRef.current = [];
    setScanning(true);
    bump();
    const flush = () => {
      if (!buffer.length) return;
      targetsRef.current.push(...buffer.splice(0));
      bump();
    };
    const timer = setInterval(flush, 200);
    scanAll(
      plugins,
      { ...ctx, olderThan: minAge, signal: controller.signal },
      (t) => buffer.push(t),
      (message) => setErrors((e) => [...e, message]),
    ).finally(() => {
      if (controller.signal.aborted) return;
      clearInterval(timer);
      flush();
      setScanning(false);
    });
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [generation]);

  const groups = useMemo(() => groupTargets(targetsRef.current, filter), [version, filter]);
  const rows = useMemo(() => buildRows(groups, filter, collapsed, expanded), [groups, collapsed, expanded]);
  const tree = useMemo(() => buildMap(groups), [groups]);
  const colors = useMemo(() => colorIndex(tree), [tree]);
  const current = rows[Math.min(cursor, rows.length - 1)];
  if (cursor < offsetRef.current) offsetRef.current = cursor;
  else if (cursor >= offsetRef.current + listHeight) offsetRef.current = cursor - listHeight + 1;
  const offset = offsetRef.current;
  const selected = targetsRef.current.filter((t) => t.selected);
  const descriptions = useMemo(() => new Map(plugins.map((p) => [p.name, p.description ?? ''])), [plugins]);

  useEffect(() => {
    if (!pendingKey) return;
    const index = rows.findIndex((r) => r.key === pendingKey);
    if (index >= 0) moveTo(index);
    setPendingKey(null);
  }, [rows, pendingKey]);

  useEffect(() => {
    if (view !== 'list') return;
    if (!current) return setPreview([]);
    if (current.kind !== 'target') {
      const description = current.kind === 'plugin' ? descriptions.get(current.name) : '';
      const first = current.targets[0];
      const impact: Line[] = current.kind === 'plugin' && first ? [{ text: `If removed (${IMPACTS[first.impact].tag}): ${IMPACTS[first.impact].meaning}`, fg: IMPACTS[first.impact].color }] : [];
      const tool = current.kind === 'plugin' && first ? toolLines(first) : [];
      setPreview([`${current.name}: ${stats(current.targets)} selected`, ...impact, ...(description ? [description] : []), ...tool, 'space toggles the whole group, → expands, ← collapses, ? explains the tags']);
      return;
    }
    let cancelled = false;
    const t = current.target;
    const head = `${tildify(t.label)}  ·  ${human(t.size)}  ·  ${t.plugin}${t.ageDays === undefined ? '' : `  ·  last changed ${Math.floor(t.ageDays)}d ago`}`;
    const explained = [head, ...impactLines(t, ctx.recentDays, minAgeRef.current), ...toolLines(t)];
    setPreview([...explained, 'loading…']);
    const timer = setTimeout(() => {
      listing(t, 400).then(({ lines, truncated }) => {
        const prefix = tildify(t.label) + path.sep;
        const shown = lines.map((l) => (l.startsWith(prefix) ? `  ${l.slice(prefix.length)}` : l));
        if (!cancelled) setPreview([...explained, ...shown, ...(truncated ? ['… more files, press f to browse'] : [])]);
      });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [current?.key, version, view]);

  useEffect(() => {
    if (!browse || browse.entries) return;
    let cancelled = false;
    const dir = browse.dirs[browse.dirs.length - 1];
    (dir ? dirEntries(dir) : entrySizes(browse.target.paths)).then((entries) => {
      if (!cancelled) setBrowse((b) => (b ? { ...b, entries } : b));
    });
    return () => {
      cancelled = true;
    };
  }, [browse]);

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, index));
    cursorRef.current = next;
    setCursor(next);
  };

  const moveBrowse = (to: (cursor: number) => number) =>
    setBrowse((b) => {
      if (!b?.entries) return b;
      const next = Math.max(0, Math.min(b.entries.length - 1, to(b.cursor)));
      const visible = listHeight - 1;
      const offset = next < b.offset ? next : next >= b.offset + visible ? next - visible + 1 : b.offset;
      return { ...b, cursor: next, offset };
    });

  const toggle = (targets: Target[]) => {
    const value = !targets.every((t) => t.selected);
    targets.forEach((t) => (t.selected = value));
    bump();
  };

  const applyAge = (days: number) => {
    minAgeRef.current = days;
    setMinAge(days);
    for (const t of targetsRef.current) if (t.ageDays !== undefined) t.selected = preselect(t, ctx.recentDays, days);
    bump();
  };

  const stepAge = (direction: 1 | -1) => {
    const age = minAgeRef.current;
    const index = AGE_STEPS.findIndex((d) => d >= age);
    const from = index < 0 ? AGE_STEPS.length - 1 : AGE_STEPS[index] === age ? index : direction > 0 ? index - 1 : index;
    applyAge(AGE_STEPS[Math.max(0, Math.min(AGE_STEPS.length - 1, from + direction))]);
  };

  const openFiles = (target: Target) => {
    const single = target.paths.length === 1 ? [target.paths[0]] : [];
    setBrowse({ target, dirs: single, entries: null, cursor: 0, offset: 0 });
    setView('files');
  };

  const reveal = (key: string) => {
    if (key === 'root') return;
    const node = ancestry(tree, key);
    const category = node[1]?.key;
    const plugin = node[2]?.key;
    if (category) setCollapsed((s) => new Set([...s].filter((k) => k !== category)));
    if (plugin && node.length > 3) setExpanded((s) => new Set(s).add(plugin));
    setPendingKey(key);
  };

  const finishClean = () => {
    targetsRef.current = targetsRef.current.filter((t) => !cleanedRef.current.has(t.id));
    cleanedRef.current = new Set();
    setView('list');
    setBrowse(null);
    setLog([]);
    setCleanDone(false);
    moveTo(cursor);
    bump();
  };

  useEffect(() => {
    if (view !== 'clean') return;
    const tools = missingTools(selected).filter((t) => install.has(t.bin));
    runClean({ targets: selected, install: tools, uninstallAfter, hooks, useTrash }, (line) => setLog((l) => [...l, line])).then(({ freed, cleaned }) => {
      cleaned.forEach((id) => cleanedRef.current.add(id));
      setLog((l) => [...l, '', `Done. Freed about ${human(freed)}${useTrash ? ' once the Trash is emptied' : ''}. Press enter to go back.`]);
      setCleanDone(true);
    });
  }, [view]);

  const activeKey = view === 'files' ? browse?.entries?.[browse.cursor]?.path : current?.key;
  const mapRoot = view === 'files' && browse ? filesMap(browse, colors.get(`t${browse.target.id}`) ?? '#5f87af') : tree;
  const sunburstDepth = view === 'files' ? 1 : SUNBURST_DEPTH;
  const treemapFocus = view === 'files' ? mapRoot : (ancestry(tree, activeKey ?? '').slice(-2, -1)[0] ?? tree);

  const mapGrid = useMemo(() => {
    if (!showMap) return [];
    if (mapMode === 'treemap') return renderTreemap(treemapRects(treemapFocus, mapInner.w, mapInner.h), mapInner.w, mapInner.h, activeKey, (n) => human(n.size));
    const focus = ancestry(mapRoot, activeKey ?? '').at(-1) ?? mapRoot;
    const share = mapRoot.size ? `${Math.round((focus.size / mapRoot.size) * 100)}%` : '';
    return renderSunburst(mapRoot, mapInner.w, mapInner.h, activeKey, [focus.label, human(focus.size), share], sunburstDepth);
  }, [showMap, mapMode, mapRoot, activeKey, mapInner.w, mapInner.h]);

  const keyAtMap = (event: MouseEvent): string | 'center' | null => {
    const box = mapRef.current;
    if (!box) return null;
    const x = event.x - box.screenX - 1;
    const y = event.y - box.screenY - 1;
    if (mapMode === 'treemap') return rectAt(treemapRects(treemapFocus, mapInner.w, mapInner.h), x, y)?.node.key ?? null;
    const hit = arcAtPixel(sunburstArcs(mapRoot, sunburstDepth), sunburstGeometry(mapInner.w, mapInner.h, sunburstDepth), x, y * 2);
    return hit === 'center' ? 'center' : (hit?.node.key ?? null);
  };

  const onMapClick = (event: MouseEvent) => {
    const key = keyAtMap(event);
    if (!key) return;
    if (view === 'files' && browse?.entries) {
      if (key === 'center') return leaveDir();
      const index = browse.entries.findIndex((e) => e.path === key);
      if (index === browse.cursor && browse.entries[index].isDir) return enterDir(browse.entries[index]);
      return moveBrowse(() => index);
    }
    if (key === 'center') {
      const parent = ancestry(tree, activeKey ?? '').slice(-2, -1)[0];
      if (parent && parent.key !== 'root') reveal(parent.key);
      return;
    }
    reveal(key);
  };

  const enterDir = (entry: Entry) => setBrowse((b) => (b ? { ...b, dirs: [...b.dirs, entry.path], entries: null, cursor: 0, offset: 0 } : b));

  const leaveDir = () => {
    if (!browse) return;
    const atRoot = browse.dirs.length === 0 || (browse.dirs.length === 1 && browse.target.paths.length === 1);
    if (atRoot) {
      setView('list');
      setBrowse(null);
      return;
    }
    setBrowse({ ...browse, dirs: browse.dirs.slice(0, -1), entries: null, cursor: 0, offset: 0 });
  };

  const handleKey = (key: KeyEvent) => {
    const char = key.sequence.length === 1 && !key.ctrl && !key.meta ? key.sequence : '';
    const cursor = cursorRef.current;
    const current = rows[Math.min(cursor, rows.length - 1)];
    if (view === 'help') return setView(browse ? 'files' : 'list');
    if (view === 'clean') {
      if (cleanDone && (key.name === 'return' || key.name === 'escape' || char === 'q')) finishClean();
      return;
    }
    if (view === 'tools') {
      const tools = missingTools(selected);
      if (key.name === 'down' || char === 'j') setToolCursor((c) => Math.min(tools.length, c + 1));
      else if (key.name === 'up' || char === 'k') setToolCursor((c) => Math.max(0, c - 1));
      else if (char === ' ' && toolCursor === tools.length) setUninstallAfter((u) => !u);
      else if (char === ' ') {
        const bin = tools[toolCursor].bin;
        setInstall((s) => (s.has(bin) ? new Set([...s].filter((b) => b !== bin)) : new Set(s).add(bin)));
      } else if (char === 'a') setInstall((s) => (s.size === tools.length ? new Set() : new Set(tools.map((t) => t.bin))));
      else if (key.name === 'return') {
        setConfirmOffset(0);
        setView('confirm');
      } else if (char === 'n' || key.name === 'escape') setView(browse ? 'files' : 'list');
      return;
    }
    if (view === 'confirm') {
      if (char === 'y') setView('clean');
      else if (char === 'n' || key.name === 'escape') setView(browse ? 'files' : 'list');
      else if (key.name === 'down' || char === 'j') setConfirmOffset((o) => o + 1);
      else if (key.name === 'up' || char === 'k') setConfirmOffset((o) => Math.max(0, o - 1));
      else if (key.name === 'pagedown') setConfirmOffset((o) => o + listHeight);
      else if (key.name === 'pageup') setConfirmOffset((o) => Math.max(0, o - listHeight));
      return;
    }
    if (filtering) {
      if (key.name === 'return') setFiltering(false);
      else if (key.name === 'escape') {
        setFilter('');
        setFiltering(false);
      } else if (key.name === 'backspace' || key.name === 'delete') setFilter((f) => f.slice(0, -1));
      else if (char) setFilter((f) => f + char);
      moveTo(0);
      return;
    }
    if (char === '?') return setView('help');
    if (char === 'm') return setMapMode((m) => (m === 'sunburst' ? 'treemap' : m === 'treemap' ? 'off' : 'sunburst'));
    if (char === 'd' && selected.length) {
      const tools = missingTools(selected);
      setConfirmOffset(0);
      setInstall(new Set(tools.map((t) => t.bin)));
      setToolCursor(0);
      return setView(tools.length ? 'tools' : 'confirm');
    }
    if (char === 'q') {
      abortRef.current?.abort();
      return onExit();
    }
    if (view === 'files' && browse) {
      const entry = browse.entries?.[browse.cursor];
      if (key.name === 'down' || char === 'j') moveBrowse((c) => c + 1);
      else if (key.name === 'up' || char === 'k') moveBrowse((c) => c - 1);
      else if (key.name === 'pagedown') moveBrowse((c) => c + listHeight);
      else if (key.name === 'pageup') moveBrowse((c) => c - listHeight);
      else if ((key.name === 'return' || key.name === 'right' || char === 'l') && entry?.isDir) enterDir(entry);
      else if (key.name === 'left' || key.name === 'backspace' || char === 'h') leaveDir();
      else if (key.name === 'escape' || char === 'f') {
        setView('list');
        setBrowse(null);
      } else if (char === ' ') toggle([browse.target]);
      return;
    }
    if (key.name === 'down' || char === 'j') moveTo(cursor + 1);
    else if (key.name === 'up' || char === 'k') moveTo(cursor - 1);
    else if (key.name === 'pagedown') moveTo(cursor + listHeight);
    else if (key.name === 'pageup') moveTo(cursor - listHeight);
    else if (key.name === 'home' || char === 'g') moveTo(0);
    else if (key.name === 'end' || char === 'G') moveTo(rows.length - 1);
    else if (char === ' ' && current) {
      toggle(current.kind === 'target' ? [current.target] : current.targets);
      if (current.kind === 'target') moveTo(cursor + 1);
    } else if ((key.name === 'right' || key.name === 'return' || char === 'l' || char === 'f') && current) {
      if (current.kind === 'category') setCollapsed((s) => new Set([...s].filter((k) => k !== current.key)));
      if (current.kind === 'plugin') setExpanded((s) => new Set(s).add(current.key));
      if (current.kind === 'target') openFiles(current.target);
    } else if ((key.name === 'left' || char === 'h') && current) {
      if (current.kind === 'category') setCollapsed((s) => new Set(s).add(current.key));
      if (current.kind === 'plugin') setExpanded((s) => new Set([...s].filter((k) => k !== current.key)));
      if (current.kind === 'target') {
        setExpanded((s) => new Set([...s].filter((k) => k !== current.parent)));
        moveTo(rows.findIndex((r) => r.key === current.parent));
      }
    } else if (char === ']') stepAge(1);
    else if (char === '[') stepAge(-1);
    else if (char === 'a') {
      const visible = rows.flatMap((r) => (r.kind === 'target' ? [r.target] : []));
      toggle(visible.length ? visible : targetsRef.current.filter((t) => matches(t, filter)));
    } else if (char === 'e') setExpanded((s) => (s.size ? new Set() : new Set(rows.filter((r) => r.kind === 'plugin').map((r) => r.key))));
    else if (char === '/') setFiltering(true);
    else if (key.name === 'escape' && filter) setFilter('');
    else if (char === 't') setUseTrash((v) => !v);
    else if (char === 'r') {
      setErrors(configErrors);
      moveTo(0);
      setGeneration((g) => g + 1);
    }
  };

  useKeyboard(handleKey);

  const header = (
    <text wrapMode="none">
      <strong fg="cyan">putzteufel</strong>
      {`  ${targetsRef.current.length} found · ${selected.length} selected · ${human(sum(selected))} to free · `}
      <span fg="cyan">{minAge ? `older than ${minAge}d` : 'any age'}</span>
      {' · '}
      <span fg={useTrash ? 'yellow' : 'red'}>{useTrash ? 'trash mode' : 'delete mode'}</span>
      {scanning ? <span fg="cyan"> · scanning…</span> : null}
      {errors.length ? <span fg="red">{` · ${errors.length} warning(s)`}</span> : null}
    </text>
  );

  if (view === 'tools') {
    const tools = missingTools(selected);
    const usage = (bin: string) => selected.filter((t) => t.tool?.bin === bin);
    return (
      <box flexDirection="column" height={height}>
        {header}
        <box flexDirection="column" height={height - 2} border borderStyle="rounded" borderColor="yellow" title=" native tools " padding={1}>
          <text wrapMode="none">{fit('These items have their own cleanup tool, which is not installed.', width - 4)}</text>
          <text wrapMode="none" fg={MUTED}>{fit('Checked tools are installed first and do the cleanup. Unchecked ones: their folders are deleted directly.', width - 4)}</text>
          <text> </text>
          {tools.map((t, i) => {
            const items = usage(t.bin);
            return (
              <text key={t.bin} wrapMode="none" bg={i === toolCursor ? ACTIVE_BG : undefined}>
                {`${install.has(t.bin) ? '[x]' : '[ ]'} `}
                <strong>{t.bin.padEnd(14)}</strong>
                <span fg="yellow">{`$ ${t.install}`.padEnd(36)}</span>
                <span fg={MUTED}>{fit(`  then $ ${t.clean[0]?.run ?? ''}  ·  ${items.length} item(s), ${human(sum(items))}: ${[...new Set(items.map((x) => x.plugin))].join(', ')}`, Math.max(10, width - 60))}</span>
              </text>
            );
          })}
          <text> </text>
          <text wrapMode="none" bg={toolCursor === tools.length ? ACTIVE_BG : undefined}>
            {`${uninstallAfter ? '[x]' : '[ ]'} `}
            {fit('Uninstall the tools installed here after the cleanup (only the formula; dependencies brew pulled in stay)', width - 10)}
          </text>
        </box>
        <text fg={MUTED}>{fit('↑↓ move · space toggle · a all · enter review the cleanup · esc cancel', width)}</text>
      </box>
    );
  }

  if (view === 'confirm' || view === 'clean' || view === 'help') {
    const lines: Line[] = view === 'confirm' ? confirmLines(selected, useTrash, install, uninstallAfter, hooks) : view === 'help' ? helpLines(ctx.recentDays) : log;
    const visible = height - 4;
    const start = view === 'confirm' ? Math.min(confirmOffset, Math.max(0, lines.length - visible)) : Math.max(0, lines.length - visible);
    return (
      <box flexDirection="column" height={height}>
        {header}
        <box flexDirection="column" height={height - 2} border borderStyle="rounded" borderColor={view === 'confirm' ? 'red' : view === 'help' ? '#444444' : 'cyan'}>
          {lines.slice(start, start + visible).map((line, i) => (
            <LineText key={i} line={line} width={width - 2} />
          ))}
        </box>
        <text fg={MUTED}>{view === 'confirm' ? 'y confirm · n/esc cancel · ↑↓ scroll' : view === 'help' ? 'any key closes' : cleanDone ? 'enter back to list' : 'cleaning…'}</text>
      </box>
    );
  }

  const listPane =
    view === 'files' && browse ? (
      <box flexDirection="column" height={listHeight}>
        <text wrapMode="none" fg="cyan">
          {fit(`${browse.target.selected ? '[x]' : '[ ]'} ${tildify(browse.dirs.at(-1) ?? browse.target.label)}  ·  ${human(browse.entries?.reduce((n, e) => n + e.size, 0))}`, listWidth)}
        </text>
        {!browse.entries ? <text fg={MUTED}>measuring…</text> : null}
        {browse.entries?.length === 0 ? <text fg={MUTED}>{browse.target.paths.length ? 'empty' : 'no files: this item runs a tool command, see the preview'}</text> : null}
        {(browse.entries ?? []).slice(browse.offset, browse.offset + listHeight - 1).map((e, i) => (
          <text key={e.path} wrapMode="none" bg={browse.offset + i === browse.cursor ? ACTIVE_BG : undefined}>
            <span fg={entryColor(browse.offset + i)}>● </span>
            {`${human(e.size).padStart(7)}  `}
            {fit(e.name + (e.isDir ? '/' : ''), listWidth - 14)}
          </text>
        ))}
      </box>
    ) : (
      <box flexDirection="column" height={listHeight}>
        {rows.length === 0 ? <text fg={MUTED}>{scanning ? 'Scanning…' : 'Nothing to clean.'}</text> : null}
        {rows.slice(offset, offset + listHeight).map((row, i) => (
          <RowLine key={row.key} row={row} active={offset + i === cursor} young={(t) => isYounger(t, ctx.recentDays, minAge)} width={listWidth} color={colors.get(row.key)} />
        ))}
      </box>
    );

  const browseEntry = browse?.entries?.[browse.cursor];
  const previewLines: Line[] =
    view === 'files' && browse
      ? browseEntry
        ? [`${tildify(browseEntry.path)}  ·  ${human(browseEntry.size)}  ·  ${browseEntry.isDir ? 'folder, enter opens it' : 'file'}`, ...impactLines(browse.target, ctx.recentDays, minAge), 'space selects or deselects the whole item; it is removed as one unit']
        : [...browse.target.commands.map((c) => `$ ${describeCommand(c)}`), ...browse.target.listed, ...impactLines(browse.target, ctx.recentDays, minAge)]
      : errors.length && !preview.length
        ? errors.slice(-previewHeight + 1)
        : preview;

  const footer =
    view === 'files'
      ? '↑↓ move · enter open · ←/backspace up · space toggle item · m map · d clean · ? tags · esc/f back · q quit'
      : `${filtering || filter ? `filter: ${filter}${filtering ? '▌' : ''}   ` : ''}↑↓ move · space toggle · enter/f files · [ ] age · m map · a all · / filter · t trash · d clean · r rescan · ? tags · q quit`;

  return (
    <box flexDirection="column" height={height}>
      {header}
      <box flexDirection="row" height={bodyHeight}>
        <box flexDirection="column" width={listWidth}>
          {listPane}
          <box flexDirection="column" height={previewHeight} border={['top']} borderColor="#444444">
            {previewLines.slice(0, previewHeight - 1).map((line, i) => (
              <LineText key={i} line={line} width={listWidth} fg={i > 0 ? MUTED : undefined} />
            ))}
          </box>
        </box>
        {showMap ? (
          <box
            ref={mapRef}
            width={mapWidth}
            height={bodyHeight}
            flexDirection="column"
            border
            borderStyle="rounded"
            borderColor="#444444"
            title={mapMode === 'sunburst' ? ' sunburst · m treemap ' : ' treemap · m hide '}
            onMouseDown={onMapClick}
          >
            <CellRows grid={mapGrid} />
          </box>
        ) : null}
      </box>
      <text fg={MUTED} wrapMode="none">
        {fit(footer, width)}
      </text>
    </box>
  );
}

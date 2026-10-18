import path from 'node:path';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { type Plugin, type ScanContext, type Target, cleanTarget, describeCommand, human, isRecent, listing, tildify } from './core.ts';
import { scanAll } from './scan.ts';

type Row =
  | { kind: 'category'; key: string; name: string; targets: Target[] }
  | { kind: 'plugin'; key: string; name: string; targets: Target[] }
  | { kind: 'target'; key: string; target: Target; parent: string };

type View = 'list' | 'confirm' | 'clean';

export interface AppProps {
  plugins: Plugin[];
  ctx: Omit<ScanContext, 'signal'>;
  configErrors?: string[];
}

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

function buildRows(targets: Target[], filter: string, collapsed: Set<string>, expanded: Set<string>): Row[] {
  const categories = new Map<string, Map<string, Target[]>>();
  for (const t of targets.filter((t) => matches(t, filter))) {
    const plugins = categories.get(t.category) ?? new Map<string, Target[]>();
    categories.set(t.category, plugins);
    plugins.set(t.plugin, [...(plugins.get(t.plugin) ?? []), t]);
  }
  const rows: Row[] = [];
  const ordered = [...categories.entries()].sort(([a, pa], [b, pb]) =>
    a === 'Projects' ? -1 : b === 'Projects' ? 1 : sum([...pb.values()].flat()) - sum([...pa.values()].flat()),
  );
  for (const [category, plugins] of ordered) {
    rows.push({ kind: 'category', key: category, name: category, targets: [...plugins.values()].flat() });
    if (collapsed.has(category)) continue;
    for (const [plugin, list] of [...plugins.entries()].sort(([, a], [, b]) => sum(b) - sum(a))) {
      const key = `${category}/${plugin}`;
      rows.push({ kind: 'plugin', key, name: plugin, targets: list });
      if (!expanded.has(key) && !filter) continue;
      for (const target of [...list].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))) rows.push({ kind: 'target', key: `t${target.id}`, target, parent: key });
    }
  }
  return rows;
}

function targetDetail(t: Target): string {
  const relative = t.paths.map((p) => path.relative(t.label, p)).filter((r) => r && !r.startsWith('..'));
  if (relative.length) return relative.join(', ');
  if (t.commands.length) return `via ${t.commands[0].run}`;
  return '';
}

function RowLine({ row, active, recentDays, width }: { row: Row; active: boolean; recentDays: number; width: number }) {
  if (row.kind === 'category') {
    return (
      <Text inverse={active} bold wrap="truncate-end">
        {`${row.name}  `}
        <Text dimColor={!active}>{stats(row.targets)}</Text>
      </Text>
    );
  }
  if (row.kind === 'plugin') {
    return (
      <Text inverse={active} wrap="truncate-end">
        {`  ${box(row.targets)} ${row.name}  `}
        <Text dimColor={!active}>{stats(row.targets)}</Text>
      </Text>
    );
  }
  const t = row.target;
  const age = t.ageDays === undefined ? '' : `${Math.floor(t.ageDays)}d`;
  return (
    <Text inverse={active} wrap="truncate-middle" color={t.selected ? undefined : 'gray'}>
      {`      ${t.selected ? '[x]' : '[ ]'} ${human(t.size).padStart(7)} ${age.padStart(5)}  ${tildify(t.label)}  `.slice(0, width)}
      <Text dimColor>{targetDetail(t)}</Text>
      {t.safety === 'costly' ? <Text color="yellow"> costly</Text> : null}
      {isRecent(t, recentDays) ? <Text color="cyan"> recent</Text> : null}
    </Text>
  );
}

function confirmLines(selected: Target[], useTrash: boolean): string[] {
  const lines = [
    `${useTrash ? 'Move to Trash' : 'Permanently delete'} ${selected.length} item(s), about ${human(sum(selected))}.`,
    'Items with a $ line run that tool command instead of deleting files.',
    '',
  ];
  for (const t of [...selected].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))) {
    lines.push(`${human(t.size).padStart(7)}  [${t.plugin}] ${tildify(t.label)}`);
    for (const c of t.commands) lines.push(`           $ ${describeCommand(c)}`);
    if (!t.commands.length) for (const p of t.paths) if (p !== t.label) lines.push(`           - ${tildify(p)}`);
    for (const l of t.listed.slice(0, 5)) lines.push(`           · ${l}`);
  }
  return lines;
}

export function App({ plugins, ctx, configErrors = [] }: AppProps) {
  const { exit } = useApp();
  const stdout = useStdout().stdout as NodeJS.WriteStream;
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const targetsRef = useRef<Target[]>([]);
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const [generation, setGeneration] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [errors, setErrors] = useState<string[]>(configErrors);
  const [cursor, setCursor] = useState(0);
  const [offset, setOffset] = useState(0);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [expanded, setExpanded] = useState(new Set<string>());
  const [filter, setFilter] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [useTrash, setUseTrash] = useState(false);
  const [view, setView] = useState<View>('list');
  const [confirmOffset, setConfirmOffset] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [cleanDone, setCleanDone] = useState(false);
  const [preview, setPreview] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const cleanedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    stdout.on('resize', rerender);
    return () => {
      stdout.off('resize', rerender);
    };
  }, [stdout]);

  const height = stdout.rows || 24;
  const width = stdout.columns || 100;
  const previewHeight = Math.max(4, Math.floor(height * 0.3));
  const listHeight = Math.max(3, height - previewHeight - 3);

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
      { ...ctx, signal: controller.signal },
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

  const rows = useMemo(() => buildRows(targetsRef.current, filter, collapsed, expanded), [version, filter, collapsed, expanded]);
  const current = rows[Math.min(cursor, rows.length - 1)];
  const selected = targetsRef.current.filter((t) => t.selected);
  const descriptions = useMemo(() => new Map(plugins.map((p) => [p.name, p.description ?? ''])), [plugins]);

  useEffect(() => {
    if (!current) return setPreview([]);
    if (current.kind !== 'target') {
      const description = current.kind === 'plugin' ? descriptions.get(current.name) : '';
      setPreview([`${current.name}: ${stats(current.targets)} selected`, ...(description ? [description] : []), 'space toggles the whole group, → expands, ← collapses']);
      return;
    }
    let cancelled = false;
    const t = current.target;
    const head = `${tildify(t.label)}  ·  ${human(t.size)}  ·  ${t.plugin}  ·  ${t.safety}${t.ageDays === undefined ? '' : `  ·  last edited ${Math.floor(t.ageDays)}d ago`}`;
    setPreview([head, 'loading…']);
    const timer = setTimeout(() => {
      listing(t, 400).then(({ lines, truncated }) => {
        const prefix = tildify(t.label) + path.sep;
        const shown = lines.map((l) => (l.startsWith(prefix) ? `  ${l.slice(prefix.length)}` : l));
        if (!cancelled) setPreview([head, ...shown, ...(truncated ? ['… more files'] : [])]);
      });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [current?.key, version]);

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, index));
    setCursor(next);
    if (next < offset) setOffset(next);
    else if (next >= offset + listHeight) setOffset(next - listHeight + 1);
  };

  const toggle = (targets: Target[]) => {
    const value = !targets.every((t) => t.selected);
    targets.forEach((t) => (t.selected = value));
    bump();
  };

  const finishClean = () => {
    targetsRef.current = targetsRef.current.filter((t) => !cleanedRef.current.has(t.id));
    cleanedRef.current = new Set();
    setView('list');
    setLog([]);
    setCleanDone(false);
    moveTo(cursor);
    bump();
  };

  useEffect(() => {
    if (view !== 'clean') return;
    let freed = 0;
    (async () => {
      for (const t of selected) {
        setLog((l) => [...l, `… ${tildify(t.label)}`]);
        const failures = await cleanTarget(t, useTrash);
        if (failures.length) setLog((l) => [...l, ...failures.map((f) => `✗ ${f}`)]);
        else {
          freed += t.size ?? 0;
          cleanedRef.current.add(t.id);
          setLog((l) => [...l, `✓ ${tildify(t.label)}`]);
        }
      }
      setLog((l) => [...l, '', `Done. Freed about ${human(freed)}${useTrash ? ' once the Trash is emptied' : ''}. Press enter to go back.`]);
      setCleanDone(true);
    })();
  }, [view]);

  useInput((input, key) => {
    if (view === 'clean') {
      if (cleanDone && (key.return || key.escape || input === 'q')) finishClean();
      return;
    }
    if (view === 'confirm') {
      if (input === 'y') setView('clean');
      else if (input === 'n' || key.escape) setView('list');
      else if (key.downArrow || input === 'j') setConfirmOffset((o) => o + 1);
      else if (key.upArrow || input === 'k') setConfirmOffset((o) => Math.max(0, o - 1));
      else if (key.pageDown) setConfirmOffset((o) => o + listHeight);
      else if (key.pageUp) setConfirmOffset((o) => Math.max(0, o - listHeight));
      return;
    }
    if (filtering) {
      if (key.return) setFiltering(false);
      else if (key.escape) {
        setFilter('');
        setFiltering(false);
      } else if (key.backspace || key.delete) setFilter((f) => f.slice(0, -1));
      else if (input && !key.ctrl && !key.meta) setFilter((f) => f + input);
      moveTo(0);
      return;
    }
    if (key.downArrow || input === 'j') moveTo(cursor + 1);
    else if (key.upArrow || input === 'k') moveTo(cursor - 1);
    else if (key.pageDown) moveTo(cursor + listHeight);
    else if (key.pageUp) moveTo(cursor - listHeight);
    else if (key.home || input === 'g') moveTo(0);
    else if (key.end || input === 'G') moveTo(rows.length - 1);
    else if (input === ' ' && current) {
      toggle(current.kind === 'target' ? [current.target] : current.targets);
      if (current.kind === 'target') moveTo(cursor + 1);
    } else if ((key.rightArrow || key.return || input === 'l') && current) {
      if (current.kind === 'category') setCollapsed((s) => new Set([...s].filter((k) => k !== current.key)));
      if (current.kind === 'plugin') setExpanded((s) => new Set(s).add(current.key));
    } else if ((key.leftArrow || input === 'h') && current) {
      if (current.kind === 'category') setCollapsed((s) => new Set(s).add(current.key));
      if (current.kind === 'plugin') setExpanded((s) => new Set([...s].filter((k) => k !== current.key)));
      if (current.kind === 'target') {
        setExpanded((s) => new Set([...s].filter((k) => k !== current.parent)));
        moveTo(rows.findIndex((r) => r.key === current.parent));
      }
    } else if (input === 'a') toggle(rows.flatMap((r) => (r.kind === 'target' ? [r.target] : [])).length ? rows.flatMap((r) => (r.kind === 'target' ? [r.target] : [])) : targetsRef.current.filter((t) => matches(t, filter)));
    else if (input === 'e') setExpanded((s) => (s.size ? new Set() : new Set(rows.filter((r) => r.kind === 'plugin').map((r) => r.key))));
    else if (input === '/') setFiltering(true);
    else if (key.escape && filter) setFilter('');
    else if (input === 't') setUseTrash((v) => !v);
    else if (input === 'r') {
      setErrors(configErrors);
      moveTo(0);
      setGeneration((g) => g + 1);
    } else if (input === 'd' && selected.length) {
      setConfirmOffset(0);
      setView('confirm');
    } else if (input === 'q') {
      abortRef.current?.abort();
      exit();
    }
  });

  const header = (
    <Text wrap="truncate-end">
      <Text bold color="cyan">
        putzteufel
      </Text>
      {`  ${targetsRef.current.length} found · ${selected.length} selected · ${human(sum(selected))} to free · `}
      <Text color={useTrash ? 'yellow' : 'red'}>{useTrash ? 'trash mode' : 'delete mode'}</Text>
      {scanning ? <Text color="cyan"> · scanning…</Text> : null}
      {errors.length ? <Text color="red">{` · ${errors.length} warning(s)`}</Text> : null}
    </Text>
  );

  if (view !== 'list') {
    const lines = view === 'confirm' ? confirmLines(selected, useTrash) : log;
    const start = view === 'confirm' ? Math.min(confirmOffset, Math.max(0, lines.length - (height - 3))) : Math.max(0, lines.length - (height - 3));
    return (
      <Box flexDirection="column" height={height}>
        {header}
        <Box flexDirection="column" height={height - 2} borderStyle="round" borderColor={view === 'confirm' ? 'red' : 'cyan'}>
          {lines.slice(start, start + height - 4).map((line, i) => (
            <Text key={i} wrap="truncate-end">
              {line}
            </Text>
          ))}
        </Box>
        <Text dimColor>{view === 'confirm' ? 'y confirm · n/esc cancel · ↑↓ scroll' : cleanDone ? 'enter back to list' : 'cleaning…'}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={height}>
      {header}
      <Box flexDirection="column" height={listHeight}>
        {rows.length === 0 ? <Text dimColor>{scanning ? 'Scanning…' : 'Nothing to clean.'}</Text> : null}
        {rows.slice(offset, offset + listHeight).map((row, i) => (
          <RowLine key={row.key} row={row} active={offset + i === cursor} recentDays={ctx.recentDays} width={width} />
        ))}
      </Box>
      <Box flexDirection="column" height={previewHeight} borderStyle="single" borderLeft={false} borderRight={false} borderBottom={false} borderDimColor>
        {(errors.length && !preview.length ? errors.slice(-previewHeight + 1) : preview.slice(0, previewHeight - 1)).map((line, i) => (
          <Text key={i} wrap="truncate-end" dimColor={i > 0}>
            {line}
          </Text>
        ))}
      </Box>
      <Text dimColor wrap="truncate-end">
        {filtering || filter ? `filter: ${filter}${filtering ? '▌' : ''}   ` : ''}
        ↑↓ move · space toggle · →/← expand · a all · / filter · t trash · d clean · r rescan · q quit
      </Text>
    </Box>
  );
}

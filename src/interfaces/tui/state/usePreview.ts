import path from 'node:path';
import { useEffect, useState } from 'react';
import { describeCommand } from '../../../domain/command.ts';
import { human } from '../../../domain/format.ts';
import type { OverlapIndex } from '../../../domain/overlap.ts';
import { tildify } from '../../../domain/paths.ts';
import type { Target } from '../../../domain/types.ts';
import { listing } from '../../../infrastructure/measure.ts';
import { type Browse, currentEntry } from '../model/browse.ts';
import { type Line, impactLines, toolLines } from '../model/explain.ts';
import { type Row, ownerLabel, stats } from '../model/rows.ts';
import type { Theme } from '../theme.ts';

interface PreviewInputs {
  row?: Row;
  browse: Browse | null;
  descriptions: Map<string, string>;
  recentDays: number;
  minAge: number;
  theme: Theme;
  overlap: OverlapIndex;
  log: string[];
  busy: boolean;
  version: number;
}

function sharedLines(t: Target, overlap: OverlapIndex, theme: Theme): Line[] {
  const others = overlap.sharedWith(t);
  if (!others.length) return [];
  const cover = overlap.coveredBy(t);
  return [
    { text: `Also touched by: ${others.map((o) => `${ownerLabel(o)} (${tildify(o.label)})`).join(', ')}`, fg: theme.warn },
    ...(cover ? [{ text: `Counted once, under ${ownerLabel(cover)}; when both are selected only ${ownerLabel(cover)} cleans it.`, fg: theme.warn }] : []),
  ];
}

function groupLines(row: Exclude<Row, { kind: 'target' }>, inputs: PreviewInputs): Line[] {
  const first = row.targets[0];
  const isPlugin = row.kind === 'plugin' && first;
  const description = row.kind === 'plugin' ? inputs.descriptions.get(row.name) : '';
  const impact = isPlugin ? impactLines(first, inputs.recentDays, inputs.minAge, inputs.theme).slice(0, 1) : [];
  const tool = isPlugin && (first.tool?.clean.length || first.commands.length) ? toolLines(first, inputs.theme) : [];
  return [`${row.name}: ${stats(row.targets)} selected`, ...impact, ...(description ? [description] : []), ...tool, 'space toggles the whole group, → expands, ← collapses, ? explains the tags'];
}

function targetLines(t: Target, inputs: PreviewInputs): Line[] {
  const { theme } = inputs;
  const head = `${tildify(t.label)}  ·  ${human(t.size)}  ·  ${t.plugin}${t.item && t.item !== t.label ? ` / ${t.item}` : ''}${t.ageDays === undefined ? '' : `  ·  last changed ${Math.floor(t.ageDays)}d ago`}`;
  const linked: Line[] = t.linkedBytes ? [{ text: `${human(t.linkedBytes)} of it is hard-linked elsewhere (for example a pnpm store); that space is freed only when every link is removed.`, fg: theme.warn }] : [];
  const estimate: Line[] = t.estimated ? [{ text: 'Size and age are from the last scan; measuring now.', fg: theme.muted }] : [];
  return [head, ...estimate, ...impactLines(t, inputs.recentDays, inputs.minAge, theme), ...toolLines(t, theme), ...linked, ...sharedLines(t, inputs.overlap, theme)];
}

function browseLines(browse: Browse, inputs: PreviewInputs): Line[] {
  const entry = currentEntry(browse);
  const impact = impactLines(browse.target, inputs.recentDays, inputs.minAge, inputs.theme);
  if (!entry) return [...browse.target.commands.map((c) => `$ ${describeCommand(c)}`), ...browse.target.listed, ...impact];
  return [`${tildify(entry.path)}  ·  ${human(entry.size)}  ·  ${entry.isDir ? 'folder, enter opens it' : 'file'}`, ...impact, 'space selects or deselects the whole item; it is removed as one unit'];
}

function withLog(lines: Line[], inputs: PreviewInputs): Line[] {
  if (!inputs.log.length) return lines;
  if (!lines.length) return [];
  const [head, ...rest] = lines;
  const title: Line = { text: inputs.busy ? 'Scan log (still running):' : 'Scan log:', fg: inputs.busy ? inputs.theme.accent : inputs.theme.muted, bold: true };
  const log = [title, ...inputs.log.map((text): Line => ({ text, fg: inputs.theme.muted }))];
  return inputs.busy ? [head, ...log, '', ...rest] : [head, ...rest, '', ...log];
}

export function usePreview(inputs: PreviewInputs): Line[] {
  const [lines, setLines] = useState<Line[]>([]);
  const { row, browse } = inputs;
  useEffect(() => {
    if (browse || !row) return setLines([]);
    if (row.kind !== 'target') return setLines(groupLines(row, inputs));
    let cancelled = false;
    const explained = targetLines(row.target, inputs);
    setLines(explained);
    const slow = setTimeout(() => !cancelled && setLines([...explained, 'listing files…']), 500);
    const timer = setTimeout(() => {
      listing(row.target, 400).then(({ lines: files, truncated }) => {
        clearTimeout(slow);
        const prefix = tildify(row.target.label) + path.sep;
        const shown = files.map((l) => (l.startsWith(prefix) ? `  ${l.slice(prefix.length)}` : l));
        if (!cancelled) setLines([...explained, ...shown, ...(truncated ? ['… more files, press f to browse'] : [])]);
      });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(slow);
    };
  }, [row?.key, inputs.version, browse === null, inputs.theme, inputs.overlap]);
  return browse ? browseLines(browse, inputs) : withLog(lines, inputs);
}

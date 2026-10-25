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
import { infoLines } from '../model/log.ts';
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
  log: Line[];
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

interface Explained {
  info: Line[];
  files: Line[];
}

interface Preview {
  lines: Line[];
  logEnd: number;
}

function compose({ info, files }: Explained, inputs: PreviewInputs): Preview {
  if (!info.length) return { lines: [], logEnd: 0 };
  const gap = (lines: Line[]): Line[] => (lines.length ? ['', ...lines] : []);
  const head = [...infoLines(info, inputs.theme), ...gap(inputs.log)];
  return { lines: [...head, ...gap(files)], logEnd: head.length };
}

export function usePreview(inputs: PreviewInputs): Preview {
  const [explained, setExplained] = useState<Explained>({ info: [], files: [] });
  const { row, browse } = inputs;
  useEffect(() => {
    if (browse || !row) return setExplained({ info: [], files: [] });
    if (row.kind !== 'target') return setExplained({ info: groupLines(row, inputs), files: [] });
    let cancelled = false;
    const info = targetLines(row.target, inputs);
    setExplained({ info, files: [] });
    const slow = setTimeout(() => !cancelled && setExplained({ info, files: ['listing files…'] }), 500);
    const timer = setTimeout(() => {
      listing(row.target, 400).then(({ lines: files, truncated }) => {
        clearTimeout(slow);
        const prefix = tildify(row.target.label) + path.sep;
        const shown = files.map((l) => (l.startsWith(prefix) ? `  ${l.slice(prefix.length)}` : l));
        if (!cancelled) setExplained({ info, files: [...shown, ...(truncated ? ['… more files, press f to browse'] : [])] });
      });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(slow);
    };
  }, [row?.key, inputs.version, browse === null, inputs.theme, inputs.overlap]);
  if (!browse) return compose(explained, inputs);
  const lines = browseLines(browse, inputs);
  return { lines, logEnd: lines.length };
}

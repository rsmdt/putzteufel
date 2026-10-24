import path from 'node:path';
import { type Entry, type Target } from '../../../domain/types.ts';
import { type MapNode, categoryColor } from '../map/layout.ts';
import { type Sort, entryView, sortBy } from '../../../domain/sort.ts';

export interface Level {
  dir: string | null;
  entries: Entry[] | null;
  cursor: number;
  offset: number;
}

export interface Browse {
  target: Target;
  levels: Level[];
}

export function openBrowse(target: Target): Browse {
  return { target, levels: [{ dir: target.paths.length === 1 ? target.paths[0] : null, entries: null, cursor: 0, offset: 0 }] };
}

export function currentLevel(browse: Browse): Level {
  return browse.levels[browse.levels.length - 1];
}

export function currentEntry(browse: Browse): Entry | undefined {
  const level = currentLevel(browse);
  return level.entries?.[level.cursor];
}

export function withLevel(browse: Browse, change: (level: Level) => Level): Browse {
  return { ...browse, levels: [...browse.levels.slice(0, -1), change(currentLevel(browse))] };
}

export function enter(browse: Browse, entry: Entry): Browse {
  return { ...browse, levels: [...browse.levels, { dir: entry.path, entries: null, cursor: 0, offset: 0 }] };
}

export function leave(browse: Browse): Browse | null {
  return browse.levels.length > 1 ? { ...browse, levels: browse.levels.slice(0, -1) } : null;
}

export function moveCursor(browse: Browse, to: (cursor: number) => number, visible: number): Browse {
  return withLevel(browse, (level) => {
    if (!level.entries?.length) return level;
    const cursor = Math.max(0, Math.min(level.entries.length - 1, to(level.cursor)));
    const offset = cursor < level.offset ? cursor : cursor >= level.offset + visible ? cursor - visible + 1 : level.offset;
    return { ...level, cursor, offset };
  });
}

export function sortLevel(level: Level, sort: Sort): Level {
  if (!level.entries) return level;
  const focused = level.entries[level.cursor]?.path;
  const entries = sortBy(level.entries, sort, entryView);
  return { ...level, entries, cursor: Math.max(0, entries.findIndex((e) => e.path === focused)) };
}

export const entryColor = (index: number, hues?: number[]) => categoryColor(index, 1, index, hues);

export function browseMap(browse: Browse, color: string, hues?: number[]): MapNode {
  const level = currentLevel(browse);
  const entries = level.entries ?? [];
  const children = entries.map((e, i) => ({ key: e.path, label: e.name, size: e.size, color: entryColor(i, hues), dim: !browse.target.selected, children: [] }));
  const label = level.dir ? path.basename(level.dir) : path.basename(browse.target.label);
  return { key: 'files', label, size: entries.reduce((n, e) => n + e.size, 0), color, dim: false, children };
}

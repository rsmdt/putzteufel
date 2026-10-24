import { useEffect, useState } from 'react';
import type { Sort } from '../../../domain/sort.ts';
import type { Target } from '../../../domain/types.ts';
import { dirEntries, entrySizes } from '../../../infrastructure/measure.ts';
import { type Browse, currentEntry, currentLevel, enter, leave, moveCursor, openBrowse, sortLevel, withLevel } from '../model/browse.ts';

export interface Browser {
  browse: Browse | null;
  open: (target: Target) => void;
  close: () => void;
  move: (to: (cursor: number) => number) => void;
  enterEntry: () => void;
  leaveDir: () => void;
  goUp: () => void;
}

export function useBrowse(sort: Sort, visibleRows: number): Browser {
  const [browse, setBrowse] = useState<Browse | null>(null);

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

  const leaveDir = () => setBrowse((b) => (b ? leave(b) : b));
  return {
    browse,
    open: (target) => setBrowse(openBrowse(target)),
    close: () => setBrowse(null),
    move: (to) => setBrowse((b) => (b ? moveCursor(b, to, visibleRows) : b)),
    enterEntry: () => {
      const entry = browse ? currentEntry(browse) : undefined;
      if (entry?.isDir) setBrowse((b) => (b ? enter(b, entry) : b));
    },
    leaveDir,
    goUp: () => (browse && browse.levels.length > 1 ? leaveDir() : setBrowse(null)),
  };
}

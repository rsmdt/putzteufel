import path from 'node:path';
import { type Target } from './types.ts';

export interface OverlapIndex {
  owners: (p: string) => Target[];
  sharedWith: (t: Target) => Target[];
  coveredBy: (t: Target) => Target | undefined;
}

function prefer(a: Target, b: Target): boolean {
  if (Boolean(a.fallback) !== Boolean(b.fallback)) return !a.fallback;
  return a.id < b.id;
}

export function overlapIndex(targets: Target[]): OverlapIndex {
  const byPath = new Map<string, Target[]>();
  for (const t of targets) for (const p of t.paths) byPath.set(p, [...(byPath.get(p) ?? []), t]);
  const sorted = [...byPath.keys()].sort();

  const ancestors = (p: string): { path: string; target: Target }[] => {
    const found: { path: string; target: Target }[] = [];
    for (let dir = p; ; dir = path.dirname(dir)) {
      for (const target of byPath.get(dir) ?? []) found.push({ path: dir, target });
      if (dir === path.dirname(dir)) return found;
    }
  };

  const descendants = (p: string): Target[] => {
    const prefix = p + path.sep;
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    const found: Target[] = [];
    for (let i = lo; i < sorted.length && sorted[i].startsWith(prefix); i++) found.push(...byPath.get(sorted[i])!);
    return found;
  };

  const sharedWith = (t: Target): Target[] => {
    const others = new Map<number, Target>();
    for (const p of t.paths) for (const o of [...ancestors(p).map((a) => a.target), ...descendants(p)]) if (o.id !== t.id) others.set(o.id, o);
    return [...others.values()];
  };

  const coveredBy = (t: Target): Target | undefined => {
    if (!t.paths.length) return undefined;
    let cover: Target | undefined;
    for (const p of t.paths) {
      const hit = ancestors(p).find(({ path: at, target }) => target.id !== t.id && (at !== p || prefer(target, t)));
      if (!hit) return undefined;
      cover ??= hit.target;
    }
    return cover;
  };

  return { owners: (p) => ancestors(p).map((a) => a.target), sharedWith, coveredBy };
}

export function uniqueSize(targets: Target[]): number {
  const index = overlapIndex(targets);
  return targets.reduce((n, t) => (index.coveredBy(t) ? n : n + (t.size ?? 0)), 0);
}

export function coveredIn(targets: Target[]): Map<number, Target> {
  const index = overlapIndex(targets);
  const covered = new Map<number, Target>();
  for (const t of targets) {
    const by = index.coveredBy(t);
    if (by) covered.set(t.id, by);
  }
  return covered;
}

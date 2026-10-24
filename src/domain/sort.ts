import { type Entry, type Target } from './types.ts';

export type SortKey = 'size' | 'age' | 'name';

export interface Sort {
  key: SortKey;
  reverse: boolean;
}

export const SORT_KEYS: { key: SortKey; label: string; detail: string }[] = [
  { key: 'size', label: 'Size', detail: 'largest first' },
  { key: 'age', label: 'Age', detail: 'oldest first' },
  { key: 'name', label: 'Name', detail: 'A to Z' },
];

export const DEFAULT_SORT: Sort = { key: 'size', reverse: false };

export function describeSort(sort: Sort): string {
  return `${sort.key} ${sort.reverse ? '↑' : '↓'}`;
}

interface Sortable {
  size: number;
  age: number;
  name: string;
}

function compare(a: Sortable, b: Sortable, sort: Sort): number {
  const order = sort.key === 'size' ? b.size - a.size : sort.key === 'age' ? b.age - a.age : a.name.localeCompare(b.name);
  const tie = order || a.name.localeCompare(b.name);
  return sort.reverse ? -tie : tie;
}

export function sortBy<T>(items: T[], sort: Sort, view: (item: T) => Sortable): T[] {
  return [...items].sort((a, b) => compare(view(a), view(b), sort));
}

export function targetView(t: Target): Sortable {
  return { size: t.size ?? 0, age: t.ageDays ?? -1, name: t.label };
}

export function groupView(name: string, targets: Target[]): Sortable {
  return {
    size: targets.reduce((n, t) => n + (t.size ?? 0), 0),
    age: Math.max(-1, ...targets.map((t) => t.ageDays ?? -1)),
    name,
  };
}

export function entryView(e: Entry): Sortable {
  return { size: e.size, age: e.mtimeMs ? (Date.now() - e.mtimeMs) / 86_400_000 : -1, name: e.name };
}

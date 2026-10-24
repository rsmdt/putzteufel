import { type Impact, type Target } from './types.ts';
import { isYounger, preselect } from './impact.ts';
import { tildify } from './paths.ts';
import { fuzzyMatch } from './fuzzy.ts';

export interface Selector {
  keys?: string[];
  plugins?: string[];
  items?: string[];
  groups?: string[];
  impacts?: Impact[];
  filter?: string;
  all?: boolean;
  defaults?: boolean;
  excludeKeys?: string[];
  olderThan?: number;
}

const lower = (list?: string[]) => list?.map((s) => s.toLowerCase());

export function matchesFilter(t: Target, filter?: string): boolean {
  return !filter || [tildify(t.label), t.plugin, t.group, t.item ?? '', ...t.paths].some((field) => fuzzyMatch(field, filter));
}

export function select(targets: Target[], selector: Selector, recentDays: number): Target[] {
  const plugins = lower(selector.plugins);
  const items = lower(selector.items);
  const groups = lower(selector.groups);
  const explicit = Boolean(selector.keys?.length || plugins?.length || items?.length || groups?.length || selector.impacts?.length || selector.all || selector.defaults);
  const minAge = selector.olderThan ?? 0;
  return targets.filter((t) => {
    if (selector.excludeKeys?.includes(t.key) || !matchesFilter(t, selector.filter)) return false;
    if (selector.keys?.includes(t.key)) return true;
    if (!explicit || selector.defaults) return preselect(t, recentDays, minAge) || (Boolean(selector.defaults) && matchesNamed(t));
    if (minAge && t.ageDays !== undefined && t.ageDays < minAge) return false;
    return Boolean(selector.all) || matchesNamed(t);
  });

  function matchesNamed(t: Target): boolean {
    return Boolean(
      plugins?.includes(t.plugin.toLowerCase()) ||
        items?.includes(`${t.plugin}/${t.item ?? ''}`.toLowerCase()) ||
        groups?.includes(t.group.toLowerCase()) ||
        selector.impacts?.includes(t.impact),
    );
  }
}

export function selectionReason(t: Target, recentDays: number, minAge: number): string {
  if (preselect(t, recentDays, minAge)) return 'selected by default';
  if (isYounger(t, recentDays, minAge)) return t.project !== undefined && t.ageDays !== undefined && t.ageDays < recentDays ? `project edited in the last ${recentDays} days` : `younger than ${minAge} days`;
  return `${t.impact} items are only removed when picked`;
}

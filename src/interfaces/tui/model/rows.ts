import path from 'node:path';
import { SECTIONS, sectionOf } from '../../../domain/groups.ts';
import { type Target } from '../../../domain/types.ts';
import { human } from '../../../domain/format.ts';
import { tildify } from '../../../domain/paths.ts';
import { uniqueSize } from '../../../domain/overlap.ts';
import { bestMatch } from '../../../domain/fuzzy.ts';
import { type MapNode, categoryColor } from '../map/layout.ts';
import { type Sort, groupView, sortBy, targetView } from '../../../domain/sort.ts';

export type Row =
  | { kind: 'section'; key: string; name: string; targets: Target[] }
  | { kind: 'group'; key: string; name: string; targets: Target[] }
  | { kind: 'plugin'; key: string; name: string; targets: Target[] }
  | { kind: 'target'; key: string; target: Target; parent: string };

export type Groups = [string, [string, Target[]][]][];

interface Filtered {
  groups: Groups;
  highlights: Map<string, number[]>;
}

export const sum = (targets: Target[]) => targets.reduce((n, t) => n + (t.size ?? 0), 0);

export function box(targets: Target[]): string {
  const selected = targets.filter((t) => t.selected).length;
  return selected === 0 ? '[ ]' : selected === targets.length ? '[x]' : '[-]';
}

export function stats(targets: Target[]): string {
  const selected = targets.filter((t) => t.selected);
  return `${selected.length}/${targets.length} · ${human(uniqueSize(selected))} of ${human(uniqueSize(targets))}`;
}

export function groupTargets(targets: Target[], filter: string, sort: Sort): Filtered {
  const highlights = new Map<string, number[]>();
  const categories = new Map<string, Map<string, Target[]>>();
  for (const t of targets) {
    if (filter) {
      const hit = bestMatch([tildify(t.label), t.plugin, t.group, t.item ?? '', ...t.paths], filter);
      if (!hit) continue;
      if (hit.field === 0) highlights.set(`t${t.id}`, hit.match.positions);
      if (hit.field === 1) highlights.set(`${t.group}/${t.plugin}`, hit.match.positions);
    }
    const plugins = categories.get(t.group) ?? new Map<string, Target[]>();
    categories.set(t.group, plugins);
    plugins.set(t.plugin, [...(plugins.get(t.plugin) ?? []), t]);
  }
  const sorted = sortBy([...categories.entries()], sort, ([name, plugins]) => groupView(name, [...plugins.values()].flat()));
  const ordered = SECTIONS.flatMap((section) => sorted.filter(([name]) => sectionOf(name) === section));
  const groups: Groups = ordered.map(([category, plugins]) => [
    category,
    sortBy([...plugins.entries()], sort, ([name, list]) => groupView(name, list)).map(([plugin, list]) => [plugin, sortBy(list, sort, targetView)] as [string, Target[]]),
  ]);
  return { groups, highlights };
}

export const sectionKey = (group: string) => `section:${sectionOf(group)}`;

export function buildRows(groups: Groups, filter: string, collapsed: Set<string>, expanded: Set<string>): Row[] {
  const rows: Row[] = [];
  let section = '';
  for (const [category, plugins] of groups) {
    if (sectionOf(category) !== section) {
      section = sectionOf(category);
      const key = sectionKey(category);
      rows.push({ kind: 'section', key, name: section, targets: groups.filter(([g]) => sectionOf(g) === section).flatMap(([, ps]) => ps.flatMap(([, list]) => list)) });
    }
    if (collapsed.has(sectionKey(category))) continue;
    rows.push({ kind: 'group', key: category, name: category, targets: plugins.flatMap(([, list]) => list) });
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

export function buildMap(groups: Groups, hues?: number[], covered: Map<number, Target> = new Map()): MapNode {
  const size = (t: Target) => (covered.has(t.id) ? 0 : (t.size ?? 0));
  const total = (list: Target[]) => list.reduce((n, t) => n + size(t), 0);
  const categories = groups.map(([category, plugins], ci) => {
    const pluginNodes = plugins.map(([plugin, list], pi) => {
      const targetNodes = list.map((t, ti) => ({
        key: `t${t.id}`,
        label: tildify(t.label),
        size: size(t),
        color: categoryColor(ci, 2, ti, hues),
        dim: !t.selected,
        children: [],
      }));
      return { key: `${category}/${plugin}`, label: plugin, size: total(list), color: categoryColor(ci, 1, pi, hues), dim: !list.some((t) => t.selected), children: targetNodes };
    });
    const all = plugins.flatMap(([, list]) => list);
    return { key: category, label: category, size: total(all), color: categoryColor(ci, 0, 0, hues), dim: !all.some((t) => t.selected), children: pluginNodes };
  });
  return { key: 'root', label: 'Everything', size: categories.reduce((n, c) => n + c.size, 0), color: '#ffffff', dim: false, children: categories };
}

export function colorIndex(root: MapNode): Map<string, string> {
  const colors = new Map<string, string>();
  const visit = (n: MapNode) => {
    colors.set(n.key, n.color);
    n.children.forEach(visit);
  };
  visit(root);
  return colors;
}

export function targetDetail(t: Target): string {
  const relative = t.paths.map((p) => path.relative(t.label, p)).filter((r) => r && !r.startsWith('..'));
  if (relative.length) return relative.join(', ');
  if (t.tool && !t.tool.installed && t.tool.clean.length) return t.tool.broken ? `${t.tool.bin} failed` : `${t.tool.bin} not installed`;
  if (t.commands.length) return `via ${t.commands[0].run}`;
  return '';
}

export function ownerLabel(t: Target): string {
  return t.item && t.item !== t.label && !t.label.startsWith('/') && !t.label.startsWith('~') ? `${t.plugin} ${t.item}` : t.plugin;
}

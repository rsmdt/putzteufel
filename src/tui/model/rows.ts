import path from 'node:path';
import { type Target, human, tildify } from '../../core/index.ts';
import { bestMatch } from '../fuzzy.ts';
import { type MapNode, categoryColor } from '../map/layout.ts';
import { type Sort, groupView, sortBy, targetView } from '../sort.ts';

export type Row =
  | { kind: 'category'; key: string; name: string; targets: Target[] }
  | { kind: 'plugin'; key: string; name: string; targets: Target[] }
  | { kind: 'target'; key: string; target: Target; parent: string };

export type Groups = [string, [string, Target[]][]][];

export interface Filtered {
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
  return `${selected.length}/${targets.length} · ${human(sum(selected))} of ${human(sum(targets))}`;
}

export function groupTargets(targets: Target[], filter: string, sort: Sort): Filtered {
  const highlights = new Map<string, number[]>();
  const categories = new Map<string, Map<string, Target[]>>();
  for (const t of targets) {
    if (filter) {
      const hit = bestMatch([tildify(t.label), t.plugin, t.category, ...t.paths], filter);
      if (!hit) continue;
      if (hit.field === 0) highlights.set(`t${t.id}`, hit.match.positions);
      if (hit.field === 1) highlights.set(`${t.category}/${t.plugin}`, hit.match.positions);
    }
    const plugins = categories.get(t.category) ?? new Map<string, Target[]>();
    categories.set(t.category, plugins);
    plugins.set(t.plugin, [...(plugins.get(t.plugin) ?? []), t]);
  }
  const ordered = sortBy([...categories.entries()], sort, ([name, plugins]) => groupView(name, [...plugins.values()].flat()));
  const projectsFirst = [...ordered.filter(([name]) => name === 'Projects'), ...ordered.filter(([name]) => name !== 'Projects')];
  const groups: Groups = projectsFirst.map(([category, plugins]) => [
    category,
    sortBy([...plugins.entries()], sort, ([name, list]) => groupView(name, list)).map(([plugin, list]) => [plugin, sortBy(list, sort, targetView)] as [string, Target[]]),
  ]);
  return { groups, highlights };
}

export function buildRows(groups: Groups, filter: string, collapsed: Set<string>, expanded: Set<string>): Row[] {
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

export function buildMap(groups: Groups, hues?: number[]): MapNode {
  const categories = groups.map(([category, plugins], ci) => {
    const pluginNodes = plugins.map(([plugin, list], pi) => {
      const targetNodes = list.map((t, ti) => ({
        key: `t${t.id}`,
        label: tildify(t.label),
        size: t.size ?? 0,
        color: categoryColor(ci, 2, ti, hues),
        dim: !t.selected,
        children: [],
      }));
      return { key: `${category}/${plugin}`, label: plugin, size: sum(list), color: categoryColor(ci, 1, pi, hues), dim: !list.some((t) => t.selected), children: targetNodes };
    });
    const all = plugins.flatMap(([, list]) => list);
    return { key: category, label: category, size: sum(all), color: categoryColor(ci, 0, 0, hues), dim: !all.some((t) => t.selected), children: pluginNodes };
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

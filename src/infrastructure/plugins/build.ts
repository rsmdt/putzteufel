import { GROUPS } from '../../domain/groups.ts';
import { type Plugin } from '../../domain/types.ts';
import { type ItemSpec, type PluginDef } from '../../plugins/api.ts';
import { ItemPlugin } from './items.ts';
import { ProjectsScanner } from './projects.ts';

export function projectsScanner(defs: PluginDef[]): ProjectsScanner {
  return new ProjectsScanner(defs.flatMap((def) => (def.projects ?? []).map((rule) => ({ ...rule, plugin: def.name, group: def.group }))));
}

export function itemPlugins(defs: PluginDef[]): ItemPlugin[] {
  return defs.flatMap((def) => (def.items ?? []).map((spec) => new ItemPlugin(spec, { plugin: def.name, group: def.group })));
}

export function pluginsFrom(defs: PluginDef[], { projects = true, items = true } = {}): Plugin[] {
  return [...(projects ? [projectsScanner(defs)] : []), ...(items ? itemPlugins(defs) : [])];
}

export function singleItem(spec: ItemSpec & { group?: string }): ItemPlugin {
  const { group = GROUPS.custom, ...item } = spec;
  return new ItemPlugin(item, { plugin: spec.name, group });
}

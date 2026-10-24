import { GROUPS, IMPACT_ORDER, type Impact } from '../core/index.ts';
import type { ItemSpec, PluginDef, ProjectRule } from '../engine/define.ts';

export const SETTING_KEYS = ['roots', 'exclude', 'olderThan', 'recentDays', 'disable', 'hooks', 'icons', 'theme'];
const RULE_KEYS = ['name', 'description', 'markers', 'dirs', 'contains', 'clean', 'requires', 'impact', 'hooks'];
const ITEM_KEYS = ['name', 'description', 'paths', 'exclude', 'list', 'clean', 'sizePaths', 'requires', 'impact', 'tool', 'hooks', 'fallback', 'scan'];
const DEF_KEYS = ['name', 'group', 'description', 'items', 'projects'];
const LIST_KEYS = ['markers', 'dirs', 'contains', 'requires', 'paths', 'exclude', 'sizePaths', 'roots', 'disable'];

export class ConfigError extends Error {}

function checkStrings(value: unknown, keys: string[], what: string): void {
  if (value === undefined) return;
  if (typeof value !== 'object' || value === null) throw new ConfigError(`${what} must be an object with ${keys.join(', ')}`);
  for (const [key, v] of Object.entries(value)) {
    if (!keys.includes(key)) throw new ConfigError(`${what} has unknown key "${key}"; allowed: ${keys.join(', ')}`);
    if (typeof v !== 'string') throw new ConfigError(`${what}.${key} must be a shell command string`);
  }
}

export function checkShape(raw: Record<string, unknown>, allowed: string[], what: string): void {
  if (typeof raw !== 'object' || raw === null) throw new ConfigError(`${what} must be an object`);
  if ('category' in raw) throw new ConfigError(`${what}: "category" was replaced by "group", for example "${GROUPS.custom}" or "${GROUPS.javascript}"`);
  if ('safety' in raw) throw new ConfigError(`${what}: "safety" was replaced by "impact", one of ${IMPACT_ORDER.map((i) => `"${i}"`).join(', ')}`);
  const unknown = Object.keys(raw).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new ConfigError(`${what} has unknown key(s): ${unknown.join(', ')}`);
  for (const key of LIST_KEYS) {
    if (key in raw && (!Array.isArray(raw[key]) || !(raw[key] as unknown[]).every((v) => typeof v === 'string'))) {
      throw new ConfigError(`${what}: "${key}" must be an array of strings`);
    }
  }
  if ('impact' in raw && !IMPACT_ORDER.includes(raw.impact as Impact)) throw new ConfigError(`${what}: "impact" must be one of ${IMPACT_ORDER.map((i) => `"${i}"`).join(', ')}`);
  checkStrings(raw.hooks, ['before', 'after'], `${what}: "hooks"`);
  checkStrings(raw.tool, ['bin', 'install', 'uninstall'], `${what}: "tool"`);
  if (raw.tool && typeof (raw.tool as { bin?: unknown }).bin !== 'string') throw new ConfigError(`${what}: "tool" needs "bin", the binary to look for on PATH`);
  if ('icons' in raw && !['unicode', 'ascii', 'nerd'].includes(raw.icons as string)) throw new ConfigError(`${what}: "icons" must be "unicode", "ascii" or "nerd"`);
  if ('clean' in raw && typeof raw.clean !== 'string' && typeof raw.clean !== 'function') throw new ConfigError(`${what}: "clean" must be a shell command, or a function from a matched path to one`);
  for (const key of ['list', 'group', 'description', 'theme']) {
    if (key in raw && typeof raw[key] !== 'string') throw new ConfigError(`${what}: "${key}" must be a string`);
  }
}

export function validateRule(raw: Record<string, unknown>, what = `project rule "${raw?.name}"`): ProjectRule {
  if (typeof raw?.name !== 'string' || !raw.name) throw new ConfigError(`${what.replace(/ "undefined"$/, '')} needs a "name"`);
  checkShape(raw, RULE_KEYS, what);
  if (!(raw.dirs as string[] | undefined)?.length && !(raw.contains as string[] | undefined)?.length) throw new ConfigError(`${what} needs "dirs" or "contains"`);
  return raw as unknown as ProjectRule;
}

export function validateItem(raw: Record<string, unknown>, what: string): ItemSpec {
  if (typeof raw?.name !== 'string' || !raw.name) throw new ConfigError(`${what} needs a "name"`);
  checkShape(raw, ITEM_KEYS, what);
  if ('scan' in raw && typeof raw.scan !== 'function') throw new ConfigError(`${what}: "scan" must be a function returning targets`);
  const lists = Boolean((raw.paths as string[] | undefined)?.length || raw.list || raw.scan);
  if (raw.clean && !lists) throw new ConfigError(`${what} has "clean" but nothing that lists affected files; add "paths" or "list"`);
  if (!lists) throw new ConfigError(`${what} needs "paths", "list" or "scan"`);
  return raw as unknown as ItemSpec;
}

function list(raw: Record<string, unknown>, key: string, what: string): Record<string, unknown>[] {
  if (raw[key] === undefined) return [];
  if (!Array.isArray(raw[key])) throw new ConfigError(`${what}: "${key}" must be an array`);
  return raw[key] as Record<string, unknown>[];
}

export function validatePlugin(raw: Record<string, unknown>): PluginDef {
  if (typeof raw?.name !== 'string' || !raw.name) throw new ConfigError('plugin needs a "name"');
  const what = `plugin "${raw.name}"`;
  if (!('items' in raw) && !('projects' in raw)) {
    const { group, ...item } = raw;
    if ('category' in raw) checkShape(raw, [], what);
    if (group !== undefined && typeof group !== 'string') throw new ConfigError(`${what}: "group" must be a string`);
    return { name: raw.name, group: (group as string | undefined) ?? GROUPS.custom, items: [validateItem(item, what)] };
  }
  checkShape(raw, DEF_KEYS, what);
  const items = list(raw, 'items', what).map((item) => validateItem(item, `${what} item "${item?.name}"`));
  const projects = list(raw, 'projects', what).map((rule) => validateRule(rule, `${what} project rule "${rule?.name}"`));
  if (!items.length && !projects.length) throw new ConfigError(`${what} needs at least one entry in "items" or "projects"`);
  return { name: raw.name, group: (raw.group as string | undefined) ?? GROUPS.custom, description: raw.description as string | undefined, items, projects };
}

export function validateProjectEntry(raw: Record<string, unknown>): PluginDef {
  const { group, ...rule } = raw ?? {};
  if (group !== undefined && typeof group !== 'string') throw new ConfigError(`project rule "${raw?.name}": "group" must be a string`);
  const valid = validateRule(rule);
  return { name: valid.name, group: (group as string | undefined) ?? GROUPS.custom, projects: [valid] };
}

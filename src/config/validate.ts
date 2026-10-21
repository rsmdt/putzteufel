import { IMPACT_ORDER, type Impact } from '../core/index.ts';
import type { PluginSpec } from '../plugins/spec.ts';
import type { ProjectRule } from '../plugins/projects.ts';

export const SETTING_KEYS = ['roots', 'exclude', 'olderThan', 'recentDays', 'disable', 'hooks', 'icons', 'theme'];
const RULE_KEYS = ['name', 'description', 'markers', 'dirs', 'contains', 'clean', 'requires', 'impact', 'hooks'];
const PLUGIN_KEYS = ['name', 'category', 'description', 'paths', 'exclude', 'list', 'clean', 'sizePaths', 'requires', 'impact', 'tool', 'hooks', 'fallback', 'scan'];
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
  for (const key of ['list', 'clean', 'category', 'description', 'theme']) {
    if (key in raw && typeof raw[key] !== 'string') throw new ConfigError(`${what}: "${key}" must be a string`);
  }
}

export function validateRule(raw: Record<string, unknown>): ProjectRule {
  if (typeof raw?.name !== 'string' || !raw.name) throw new ConfigError('project rule needs a "name"');
  const what = `project rule "${raw.name}"`;
  checkShape(raw, RULE_KEYS, what);
  if (!(raw.dirs as string[] | undefined)?.length && !(raw.contains as string[] | undefined)?.length) throw new ConfigError(`${what} needs "dirs" or "contains"`);
  return raw as unknown as ProjectRule;
}

export function validatePlugin(raw: Record<string, unknown>): PluginSpec {
  if (typeof raw?.name !== 'string' || !raw.name) throw new ConfigError('plugin needs a "name"');
  const what = `plugin "${raw.name}"`;
  checkShape(raw, PLUGIN_KEYS, what);
  if ('scan' in raw && typeof raw.scan !== 'function') throw new ConfigError(`${what}: "scan" must be a function returning targets`);
  const lists = Boolean((raw.paths as string[] | undefined)?.length || raw.list || raw.scan);
  if (raw.clean && !lists) throw new ConfigError(`${what} has "clean" but nothing that lists affected files; add "paths" or "list"`);
  if (!lists) throw new ConfigError(`${what} needs "paths", "list" or "scan"`);
  return raw as unknown as PluginSpec;
}

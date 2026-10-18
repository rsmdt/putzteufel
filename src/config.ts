import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { builtinPlugins, builtinRules } from './builtin.ts';
import { exists, expandHome } from './core.ts';
import type { PluginSpec } from './plugins.ts';
import type { ProjectRule } from './projects.ts';

export interface Settings {
  roots: string[];
  exclude: string[];
  olderThan: number;
  recentDays: number;
  disable: string[];
}

export interface Config {
  settings: Settings;
  rules: ProjectRule[];
  plugins: PluginSpec[];
  errors: string[];
  sources: string[];
}

const SETTING_KEYS = ['roots', 'exclude', 'olderThan', 'recentDays', 'disable'];
const RULE_KEYS = ['name', 'markers', 'dirs', 'contains', 'clean', 'requires', 'safety'];
const PLUGIN_KEYS = ['name', 'category', 'description', 'paths', 'exclude', 'list', 'clean', 'sizePaths', 'requires', 'safety', 'fallback', 'scan'];
const LIST_KEYS = ['markers', 'dirs', 'contains', 'requires', 'paths', 'exclude', 'sizePaths', 'roots', 'disable'];

export function defaultConfigFiles(): string[] {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return [path.join(configHome, 'putzteufel', 'config.mjs'), path.join(process.cwd(), 'putzteufel.config.mjs')];
}

class ConfigError extends Error {}

function checkShape(raw: Record<string, unknown>, allowed: string[], what: string): void {
  if (typeof raw !== 'object' || raw === null) throw new ConfigError(`${what} must be an object`);
  const unknown = Object.keys(raw).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new ConfigError(`${what} has unknown key(s): ${unknown.join(', ')}`);
  for (const key of LIST_KEYS) {
    if (key in raw && (!Array.isArray(raw[key]) || !(raw[key] as unknown[]).every((v) => typeof v === 'string'))) {
      throw new ConfigError(`${what}: "${key}" must be an array of strings`);
    }
  }
  if ('safety' in raw && raw.safety !== 'safe' && raw.safety !== 'costly') throw new ConfigError(`${what}: "safety" must be "safe" or "costly"`);
  for (const key of ['list', 'clean', 'category', 'description']) {
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

interface ConfigModule {
  settings?: Partial<Settings>;
  projects?: Record<string, unknown>[];
  plugins?: Record<string, unknown>[];
}

export async function loadConfig(files: string[] = defaultConfigFiles(), { builtin = true } = {}): Promise<Config> {
  const settings: Settings = { roots: [], exclude: [], olderThan: 0, recentDays: 7, disable: [] };
  const rules = new Map<string, ProjectRule>();
  const plugins = new Map<string, PluginSpec>();
  const errors: string[] = [];
  const sources: string[] = [];
  if (builtin) {
    builtinRules.forEach((r) => rules.set(r.name, r));
    builtinPlugins.forEach((p) => plugins.set(p.name, p));
  }
  for (const file of files.map((f) => path.resolve(expandHome(f)))) {
    if (!(await exists(file))) continue;
    let mod: ConfigModule;
    try {
      mod = ((await import(pathToFileURL(file).href)) as { default?: ConfigModule }).default ?? {};
    } catch (e) {
      errors.push(`${file}: ${(e as Error).message}`);
      continue;
    }
    sources.push(file);
    try {
      checkShape((mod.settings ?? {}) as Record<string, unknown>, SETTING_KEYS, 'settings');
      Object.assign(settings, mod.settings);
    } catch (e) {
      errors.push(`${file}: ${(e as Error).message}`);
    }
    for (const raw of mod.projects ?? []) {
      try {
        const rule = validateRule(raw);
        rules.set(rule.name, rule);
      } catch (e) {
        errors.push(`${file}: ${(e as Error).message}`);
      }
    }
    for (const raw of mod.plugins ?? []) {
      try {
        const plugin = validatePlugin(raw);
        plugins.set(plugin.name, plugin);
      } catch (e) {
        errors.push(`${file}: ${(e as Error).message}`);
      }
    }
  }
  const disabled = new Set(settings.disable);
  return {
    settings: { ...settings, roots: settings.roots.map((r) => path.resolve(expandHome(r))) },
    rules: [...rules.values()].filter((r) => !disabled.has(r.name)),
    plugins: [...plugins.values()].filter((p) => !disabled.has(p.name)),
    errors,
    sources,
  };
}

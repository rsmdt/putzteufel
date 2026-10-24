import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Hooks } from '../../domain/types.ts';
import { exists } from '../fs.ts';
import { expandHome } from '../../domain/paths.ts';
import { type PluginDef } from '../../plugins/api.ts';
import { builtinPlugins } from '../../plugins/index.ts';
import { SETTING_KEYS, checkShape, validatePlugin, validateProjectEntry } from './validate.ts';

export interface Settings {
  roots: string[];
  exclude: string[];
  olderThan: number;
  recentDays: number;
  disable: string[];
  hooks: Hooks;
  icons?: 'unicode' | 'ascii' | 'nerd';
  theme?: string;
}

export interface Config {
  settings: Settings;
  plugins: PluginDef[];
  errors: string[];
  sources: string[];
}

export function defaultConfigFiles(): string[] {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return [path.join(configHome, 'putzteufel', 'config.mjs'), path.join(process.cwd(), 'putzteufel.config.mjs')];
}

interface ConfigModule {
  settings?: Partial<Settings>;
  projects?: Record<string, unknown>[];
  plugins?: Record<string, unknown>[];
}

export async function loadConfig(files: string[] = defaultConfigFiles(), { builtin = true } = {}): Promise<Config> {
  const settings: Settings = { roots: [], exclude: [], olderThan: 0, recentDays: 7, disable: [], hooks: {} };
  const plugins = new Map<string, PluginDef>();
  const errors: string[] = [];
  const sources: string[] = [];
  if (builtin) {
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
        const plugin = validateProjectEntry(raw);
        plugins.set(plugin.name, plugin);
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
    plugins: [...plugins.values()]
      .filter((p) => !disabled.has(p.name))
      .map((p) => ({ ...p, items: p.items?.filter((i) => !disabled.has(`${p.name}/${i.name}`)), projects: p.projects?.filter((r) => !disabled.has(`${p.name}/${r.name}`)) })),
    errors,
    sources,
  };
}

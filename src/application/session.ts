import path from 'node:path';
import { type Config, defaultConfigFiles, loadConfig } from '../infrastructure/config/load.ts';
import { type Plugin, type ScanContext } from '../domain/types.ts';
import { pluginsFrom } from '../infrastructure/plugins/build.ts';
import { type PluginDef } from '../plugins/api.ts';

export interface SessionOptions {
  roots?: string[];
  configFiles?: string[];
  olderThan?: number;
  exclude?: string[];
  projects?: boolean;
  caches?: boolean;
  only?: string[];
}

export interface Session {
  config: Config;
  plugins: Plugin[];
  ctx: Omit<ScanContext, 'signal'>;
}

function only(plugins: PluginDef[], names?: string[]): PluginDef[] {
  if (!names?.length) return plugins;
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return plugins.filter((p) => wanted.has(p.name.toLowerCase()));
}

export async function openSession(options: SessionOptions = {}): Promise<Session> {
  const config = await loadConfig([...defaultConfigFiles(), ...(options.configFiles ?? [])]);
  const roots = options.roots?.length ? options.roots.map((r) => path.resolve(r)) : config.settings.roots.length ? config.settings.roots : [process.cwd()];
  return {
    config,
    plugins: pluginsFrom(only(config.plugins, options.only), { projects: options.projects !== false, items: options.caches !== false }),
    ctx: {
      roots,
      exclude: [...config.settings.exclude, ...(options.exclude ?? [])],
      olderThan: options.olderThan ?? config.settings.olderThan,
      recentDays: config.settings.recentDays,
    },
  };
}

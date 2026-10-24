import { type Hooks, type Impact, type ScanContext, type TargetDraft } from '../domain/types.ts';

export interface ItemSpec {
  name: string;
  description?: string;
  paths?: string[];
  exclude?: string[];
  list?: string;
  clean?: string | ((path: string) => string);
  sizePaths?: string[];
  requires?: string[];
  impact?: Impact;
  tool?: { bin: string; install?: string; uninstall?: string };
  hooks?: Hooks;
  fallback?: boolean;
  scan?: (ctx: ScanContext) => Promise<TargetDraft[]> | TargetDraft[];
}

export interface ProjectRule {
  name: string;
  markers?: string[];
  dirs?: string[];
  contains?: string[];
  clean?: string;
  requires?: string[];
  impact?: Impact;
  description?: string;
  hooks?: Hooks;
}

export interface PluginDef {
  name: string;
  group: string;
  description?: string;
  projects?: ProjectRule[];
  items?: ItemSpec[];
}

export interface Owner {
  plugin: string;
  group: string;
}

export function definePlugin(def: PluginDef): PluginDef {
  return def;
}

export const brew = (bin: string, formula = bin) => ({ bin, install: `brew install ${formula}`, uninstall: `brew uninstall ${formula}` });

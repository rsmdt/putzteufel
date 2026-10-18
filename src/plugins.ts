import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  type Emit,
  type Plugin,
  type Safety,
  type ScanContext,
  type Target,
  type TargetDraft,
  diskUsage,
  expandHome,
  exists,
  matchesAny,
  shell,
  which,
  wildcard,
} from './core.ts';

export interface PluginSpec {
  name: string;
  category?: string;
  description?: string;
  paths?: string[];
  exclude?: string[];
  list?: string;
  clean?: string;
  sizePaths?: string[];
  requires?: string[];
  safety?: Safety;
  fallback?: boolean;
  scan?: (ctx: ScanContext) => Promise<TargetDraft[]> | TargetDraft[];
}

export async function expand(pattern: string): Promise<string[]> {
  const absolute = path.resolve(expandHome(pattern));
  const segments = absolute.split(path.sep).filter(Boolean);
  let current: string[] = [path.sep];
  for (const segment of segments) {
    const next: string[] = [];
    for (const base of current) {
      if (!/[*?]/.test(segment)) {
        next.push(path.join(base, segment));
        continue;
      }
      const re = wildcard(segment);
      const names = await readdir(base).catch(() => [] as string[]);
      next.push(...names.filter((n) => re.test(n)).sort().map((n) => path.join(base, n)));
    }
    current = next;
  }
  const present = await Promise.all(current.map(async (p) => ((await exists(p)) ? p : null)));
  return present.filter((p): p is string => p !== null);
}

async function expandAll(patterns: string[] = []): Promise<string[]> {
  return (await Promise.all(patterns.map(expand))).flat();
}

export class SpecPlugin implements Plugin {
  name: string;
  category: string;
  description?: string;
  fallback: boolean;

  constructor(private spec: PluginSpec) {
    this.name = spec.name;
    this.category = spec.category ?? 'Custom';
    this.description = spec.description;
    this.fallback = spec.fallback ?? false;
  }

  async available(): Promise<boolean> {
    return (await Promise.all((this.spec.requires ?? []).map(which))).every(Boolean);
  }

  async scan(ctx: ScanContext, emit: Emit): Promise<void> {
    const { spec } = this;
    const safety = spec.safety ?? 'safe';
    if (spec.scan) {
      for (const draft of await spec.scan(ctx)) emit({ safety, ...draft });
      return;
    }
    const skip = [...(spec.exclude ?? []), ...ctx.exclude];
    const matched: string[] = [];
    for (const p of await expandAll(spec.paths)) {
      if (!matchesAny(p, skip) && !(await lstat(p)).isSymbolicLink()) matched.push(p);
    }
    const commands = spec.clean ? [{ run: spec.clean }] : [];
    if (!spec.list && !spec.clean) {
      for (const p of matched) emit({ label: p, paths: [p], safety });
      return;
    }
    const lines = spec.list ? (await shell(spec.list)).split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const listedPaths: string[] = [];
    const listed: string[] = [];
    for (const line of lines) {
      const candidate = expandHome(line);
      if (!path.isAbsolute(candidate)) listed.push(line);
      else if ((await exists(candidate)) && !matchesAny(candidate, skip)) listedPaths.push(candidate);
    }
    if (!matched.length && !listedPaths.length && !listed.length) return;
    emit({ label: spec.name, paths: [...matched, ...listedPaths], listed, commands, sizePaths: await expandAll(spec.sizePaths), safety });
  }

  async measure(target: Target): Promise<void> {
    const measured = [...target.paths, ...target.sizePaths];
    target.size = measured.length ? await diskUsage(measured) : undefined;
  }
}

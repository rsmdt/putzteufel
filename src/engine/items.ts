import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  type Emit,
  type Plugin,
  type ScanContext,
  type Target,
  type TargetDraft,
  diskUsage,
  newestMtime,
  expandHome,
  exists,
  matchesAny,
  shell,
  which,
  wildcard,
} from '../core/index.ts';
import type { ItemSpec, Owner } from './define.ts';

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

export class ItemPlugin implements Plugin {
  name: string;
  group: string;
  item: string;
  description?: string;
  fallback: boolean;
  tool?: { bin: string; install?: string };

  constructor(
    private spec: ItemSpec,
    owner: Owner,
  ) {
    this.name = owner.plugin;
    this.group = owner.group;
    this.item = spec.name;
    this.tool = spec.tool;
    this.description = spec.description;
    this.fallback = spec.fallback ?? false;
  }

  async available(): Promise<boolean> {
    return (await Promise.all((this.spec.requires ?? []).map(which))).every(Boolean);
  }

  async scan(ctx: ScanContext, emit: Emit): Promise<void> {
    const { spec } = this;
    const impact = spec.impact ?? 'regenerates';
    const note = spec.description;
    const hooks = spec.hooks;
    const item = this.item;
    if (spec.scan) {
      for (const draft of await spec.scan(ctx)) emit({ impact, note, hooks, item, ...draft });
      return;
    }
    const skip = [...(spec.exclude ?? []), ...ctx.exclude];
    const matched: string[] = [];
    for (const p of await expandAll(spec.paths)) {
      if (!matchesAny(p, skip) && !(await lstat(p)).isSymbolicLink()) matched.push(p);
    }
    const found = spec.tool ? await which(spec.tool.bin) : true;
    let output: string | undefined;
    let broken: string | undefined;
    if (spec.list && found) {
      output = await shell(spec.list).catch((e: Error & { stderr?: string }) => {
        if (!spec.tool) throw e;
        const lines = (e.stderr || e.message).trim().split('\n').map((l) => l.trim()).filter(Boolean);
        broken = lines.find((l) => /error/i.test(l)) ?? lines.at(-1) ?? 'list command failed';
        return undefined;
      });
    }
    const installed = found && !broken;
    const clean = spec.clean ? [{ run: spec.clean }] : [];
    const tool = spec.tool ? { ...spec.tool, installed, broken, clean } : undefined;
    const commands = installed ? clean : [];
    if (!spec.list && !spec.clean) {
      for (const p of matched) emit({ label: p, paths: [p], impact, note, hooks, item });
      return;
    }
    const lines = (output ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
    const listedPaths: string[] = [];
    const listed: string[] = [];
    for (const line of lines) {
      const candidate = expandHome(line);
      if (!path.isAbsolute(candidate)) listed.push(line);
      else if ((await exists(candidate)) && !matchesAny(candidate, skip)) listedPaths.push(candidate);
    }
    const paths = !spec.tool ? [...matched, ...listedPaths] : spec.list && installed ? listedPaths : matched;
    if (!paths.length && !listed.length) return;
    emit({ label: spec.name, paths, listed, commands, tool, hooks, item, sizePaths: await expandAll(spec.sizePaths), impact, note });
  }

  async measure(target: Target): Promise<void> {
    const measured = [...target.paths, ...target.sizePaths];
    target.size = measured.length ? await diskUsage(measured) : undefined;
    const newest = target.paths.length ? await newestMtime(target.paths) : undefined;
    target.ageDays = newest === undefined ? undefined : (Date.now() - newest) / 86_400_000;
  }
}

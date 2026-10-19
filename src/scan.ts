import path from 'node:path';
import { type Plugin, type ScanContext, type Target, type TargetDraft, limiter, preselect } from './core.ts';

let nextId = 1;

function overlaps(paths: string[], claimed: string[]): boolean {
  return paths.some((p) => claimed.some((c) => p === c || p.startsWith(c + path.sep) || c.startsWith(p + path.sep)));
}

export async function scanAll(plugins: Plugin[], ctx: ScanContext, onTarget: (t: Target) => void, onError: (message: string) => void): Promise<void> {
  const claimed: string[] = [];
  const measureLimit = limiter(8);
  const measuring: Promise<void>[] = [];

  const accept = (plugin: Plugin) => (draft: TargetDraft) => {
    if (ctx.signal.aborted) return;
    const target: Target = {
      paths: [],
      sizePaths: [],
      listed: [],
      commands: [],
      impact: 'regenerates',
      ...draft,
      id: nextId++,
      plugin: draft.plugin ?? plugin.name,
      category: plugin.category,
      selected: false,
    };
    if (!target.paths.length && !target.listed.length) {
      onError(`${plugin.name}: "${target.label}" lists no affected files, skipped`);
      return;
    }
    if (plugin.fallback && overlaps(target.paths, claimed)) return;
    claimed.push(...target.paths);
    measuring.push(
      measureLimit(async () => {
        if (ctx.signal.aborted) return;
        await plugin.measure(target);
        target.selected = preselect(target, ctx.recentDays, ctx.olderThan);
        onTarget(target);
      }).catch((e: Error) => onError(`${plugin.name}: ${e.message}`)),
    );
  };

  for (const phase of [false, true]) {
    const active: Plugin[] = [];
    for (const plugin of plugins.filter((p) => Boolean(p.fallback) === phase)) {
      if (await plugin.available()) active.push(plugin);
    }
    await Promise.all(active.map((p) => p.scan(ctx, accept(p)).catch((e: Error) => onError(`${p.name}: ${e.message}`))));
    if (ctx.signal.aborted) return;
  }
  await Promise.all(measuring);
}

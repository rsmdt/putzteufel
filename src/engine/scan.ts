import { type Plugin, type ScanContext, type Target, type TargetDraft, forgetSizes, limiter, preselect, targetKey } from '../core/index.ts';

let nextId = 1;

export interface Estimate {
  size?: number;
  linkedBytes?: number;
  ageDays?: number;
  at: number;
}

export interface ScanExtras {
  onFound?: (t: Target) => void;
  estimates?: Map<string, Estimate>;
}

function applyEstimate(target: Target, estimate: Estimate | undefined): void {
  if (!estimate || target.size !== undefined) return;
  target.size = estimate.size;
  target.linkedBytes = estimate.linkedBytes;
  if (target.ageDays === undefined && estimate.ageDays !== undefined) target.ageDays = estimate.ageDays + (Date.now() - estimate.at) / 86_400_000;
  target.estimated = true;
}

export async function scanAll(plugins: Plugin[], ctx: ScanContext, onTarget: (t: Target) => void, onError: (message: string) => void, extras: ScanExtras = {}): Promise<void> {
  forgetSizes();
  const measureLimit = limiter(8);
  const measuring: Promise<void>[] = [];

  const accept = (plugin: Plugin) => (draft: TargetDraft) => {
    if (ctx.signal.aborted) return;
    const owner = draft.plugin ?? plugin.name;
    const target: Target = {
      paths: [],
      sizePaths: [],
      listed: [],
      commands: [],
      impact: 'regenerates',
      ...draft,
      id: nextId++,
      key: targetKey({ plugin: owner, item: draft.item, label: draft.label, paths: draft.paths ?? [] }),
      plugin: owner,
      group: draft.group ?? plugin.group,
      fallback: plugin.fallback || undefined,
      selected: false,
    };
    if (!target.paths.length && !target.listed.length) {
      onError(`${plugin.name}: "${target.label}" lists no affected files, skipped`);
      return;
    }
    if (extras.onFound) {
      applyEstimate(target, extras.estimates?.get(target.key));
      target.selected = preselect(target, ctx.recentDays, ctx.olderThan);
      extras.onFound(target);
    }
    measuring.push(
      measureLimit(async () => {
        if (ctx.signal.aborted) return;
        await plugin.measure(target);
        target.estimated = undefined;
        if (!target.touched) target.selected = preselect(target, ctx.recentDays, ctx.olderThan);
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

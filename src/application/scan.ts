import { type Activity, type Estimate, type Plugin, type ScanContext, type ScanProgress, type Target, type TargetDraft } from '../domain/types.ts';
import { human } from '../domain/format.ts';
import { tildify } from '../domain/paths.ts';
import { forgetSizes } from '../infrastructure/measure.ts';
import { limiter } from '../infrastructure/shell.ts';
import { preselect } from '../domain/impact.ts';
import { targetKey } from '../domain/key.ts';

let nextId = 1;

interface ScanExtras {
  onFound?: (t: Target) => void;
  onProgress?: (progress: ScanProgress) => void;
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
  const running = new Map<string, Activity>();
  const counts = { found: 0, measured: 0 };
  const report = () => extras.onProgress?.({ running: [...running.values()], found: counts.found, measured: counts.measured, waiting: counts.found - counts.measured - [...running.values()].filter((a) => a.kind === 'measure').length });
  const begin = (activity: Omit<Activity, 'startedAt'>) => {
    running.set(activity.id, { ...activity, startedAt: Date.now() });
    report();
  };
  const end = (id: string) => {
    running.delete(id);
    report();
  };
  const labelOf = (plugin: Plugin) => (plugin.item && plugin.item !== plugin.name ? `${plugin.name} / ${plugin.item}` : plugin.name);

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
    counts.found++;
    if (extras.onFound) {
      applyEstimate(target, extras.estimates?.get(target.key));
      target.selected = preselect(target, ctx.recentDays, ctx.olderThan);
      extras.onFound(target);
    }
    measuring.push(
      measureLimit(async () => {
        if (ctx.signal.aborted) return;
        const id = `measure:${target.id}`;
        begin({ id, kind: 'measure', label: `${target.plugin}: ${tildify(target.label)}`, detail: target.paths.map(tildify).join(', ') });
        await plugin.measure(target).finally(() => {
          counts.measured++;
          end(id);
        });
        if (target.partial) onError(`${target.plugin}: measuring ${tildify(target.label)} took too long and was stopped; it is at least ${human(target.size)}`);
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
    await Promise.all(
      active.map((p, i) => {
        const id = `scan:${phase ? 'fallback' : 'main'}:${i}`;
        begin({ id, kind: 'scan', label: labelOf(p) });
        const note = (detail: string) => {
          const activity = running.get(id);
          if (activity) running.set(id, { ...activity, detail });
          report();
        };
        return p
          .scan({ ...ctx, note }, accept(p))
          .catch((e: Error) => onError(`${p.name}: ${e.message}`))
          .finally(() => end(id));
      }),
    );
    if (ctx.signal.aborted) return;
  }
  await Promise.all(measuring);
}

import { type Activity, type Estimate, type Plugin, type ScanContext, type ScanLogEntry, type ScanProgress, type Target, type TargetDraft } from '../domain/types.ts';
import { human } from '../domain/format.ts';
import { tildify } from '../domain/paths.ts';
import { forgetSizes } from '../infrastructure/measure.ts';
import { limiter } from '../infrastructure/shell.ts';
import { preselect } from '../domain/impact.ts';
import { targetKey } from '../domain/key.ts';

let nextId = 1;

const PLUGIN_TIMEOUT = Number(process.env.PUTZTEUFEL_PLUGIN_TIMEOUT_MS) || 5 * 60_000;

interface ScanExtras {
  onFound?: (t: Target) => void;
  onProgress?: (progress: ScanProgress) => void;
  onLog?: (entry: ScanLogEntry) => void;
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
  const ownersOf = (plugin: Plugin) => plugin.owners ?? [plugin.name];
  const log = (plugins: string[], text: string, targetId?: number) => extras.onLog?.({ at: Date.now(), plugins, targetId, text });
  const seconds = (since: number) => `${((Date.now() - since) / 1000).toFixed(1)}s`;

  const gaveUp = new Set<Plugin>();
  const accept = (plugin: Plugin) => (draft: TargetDraft) => {
    if (ctx.signal.aborted || gaveUp.has(plugin)) return;
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
      log([owner], `skipped ${tildify(target.label)}: it lists no affected files`);
      return;
    }
    counts.found++;
    log([owner], `found ${tildify(target.label)}${target.item && target.item !== target.label ? ` (${target.item})` : ''}`, target.id);
    if (extras.onFound) {
      applyEstimate(target, extras.estimates?.get(target.key));
      target.selected = preselect(target, ctx.recentDays, ctx.olderThan);
      extras.onFound(target);
    }
    measuring.push(
      measureLimit(async () => {
        if (ctx.signal.aborted) return;
        const id = `measure:${target.id}`;
        const started = Date.now();
        const where = target.paths.map(tildify).join(', ');
        begin({ id, kind: 'measure', label: `${target.plugin}: ${tildify(target.label)}`, plugins: [target.plugin], targetId: target.id, detail: where });
        if (where) log([target.plugin], `measuring ${where}`, target.id);
        await plugin.measure(target).finally(() => {
          counts.measured++;
          end(id);
        });
        log([target.plugin], target.size === undefined ? `nothing to measure on disk (${seconds(started)})` : `measured ${human(target.size)}${target.ageDays === undefined ? '' : `, last changed ${Math.floor(target.ageDays)}d ago`} in ${seconds(started)}`, target.id);
        if (target.partial) {
          onError(`${target.plugin}: measuring ${tildify(target.label)} took too long and was stopped; it is at least ${human(target.size)}`);
          log([target.plugin], `measuring stopped after the time limit; at least ${human(target.size)}`, target.id);
        }
        target.estimated = undefined;
        if (!target.touched) target.selected = preselect(target, ctx.recentDays, ctx.olderThan);
        onTarget(target);
      }).catch((e: Error) => {
        onError(`${plugin.name}: ${e.message}`);
        log([target.plugin], `failed: ${e.message}`, target.id);
        onTarget(target);
      }),
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
        const owners = ownersOf(p);
        const started = Date.now();
        begin({ id, kind: 'scan', label: labelOf(p), plugins: owners, group: p.owners ? undefined : p.group });
        log(owners, `looking for ${p.item && p.item !== p.name ? p.item.toLowerCase() : 'items'}`);
        let lastNote = 0;
        const note = (detail: string) => {
          const activity = running.get(id);
          if (activity) running.set(id, { ...activity, detail });
          report();
          if (Date.now() - lastNote > 1000 || detail.startsWith('running:')) {
            lastNote = Date.now();
            log(owners, detail);
          }
        };
        let timer: ReturnType<typeof setTimeout> | undefined;
        const own = new AbortController();
        const forward = () => own.abort();
        ctx.signal.addEventListener('abort', forward);
        const timeout = new Promise<'timeout'>((resolve) => (timer = setTimeout(() => resolve('timeout'), PLUGIN_TIMEOUT)));
        const work = p
          .scan({ ...ctx, signal: own.signal, note }, accept(p))
          .then(() => 'done' as const)
          .catch((e: Error) => {
            onError(`${p.name}: ${e.message}`);
            log(owners, `failed: ${e.message.split('\n')[0]}`);
            return 'done' as const;
          });
        return Promise.race([work, timeout]).then((how) => {
          clearTimeout(timer);
          ctx.signal.removeEventListener('abort', forward);
          end(id);
          if (how === 'timeout') {
            gaveUp.add(p);
            own.abort();
            onError(`${labelOf(p)}: stopped looking after ${Math.round(PLUGIN_TIMEOUT / 1000)}s; items it found so far are kept`);
            log(owners, `stopped looking after ${seconds(started)}: it took too long`);
          } else log(owners, `done looking in ${seconds(started)}`);
        });
      }),
    );
    if (ctx.signal.aborted) return;
  }
  await Promise.all(measuring);
}

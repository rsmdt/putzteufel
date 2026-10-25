import { tildify } from '../../domain/paths.ts';
import type { Activity, ScanProgress } from '../../domain/types.ts';
import type { Output } from './output.ts';

export const PROGRESS_INTERVAL = 2000;

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function progressReporter(out: Output, verbose: boolean): (progress: ScanProgress) => void {
  const known = new Map<string, Activity>();
  let lastEvent = 0;
  return (progress) => {
    const now = Date.now();
    if (out.json && now - lastEvent >= PROGRESS_INTERVAL) {
      lastEvent = now;
      out.event('progress', { found: progress.found, measured: progress.measured, waiting: progress.waiting, running: progress.running.map((a) => ({ kind: a.kind, label: a.label, detail: a.detail ?? null, seconds: Math.round((now - a.startedAt) / 1000) })) });
    }
    if (!verbose || out.json) return;
    const current = new Map(progress.running.map((a) => [a.id, a]));
    for (const [id, a] of known) if (!current.has(id)) console.error(`done   ${seconds(now - a.startedAt).padStart(7)}  ${a.label}`);
    for (const [id, a] of current) if (!known.has(id)) console.error(`start  ${a.kind.padEnd(7)}  ${a.label}${a.detail && a.kind === 'measure' ? `  (${tildify(a.detail)})` : ''}`);
    known.clear();
    for (const [id, a] of current) known.set(id, a);
  };
}

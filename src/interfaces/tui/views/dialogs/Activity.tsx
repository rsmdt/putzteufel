import { useEffect, useState } from 'react';
import { tildify } from '../../../../domain/paths.ts';
import type { ScanProgress } from '../../../../domain/types.ts';
import { Overlay } from '../../components/Overlay.tsx';
import { useLook } from '../../look.ts';
import type { Line } from '../../model/explain.ts';
import { Scrolled, type Screen, dialogRows, dialogSize, scrolledRange } from './shared.tsx';

export function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function activityLines(progress: ScanProgress, scanning: boolean, now: number): Line[] {
  const lines: Line[] = [
    { text: scanning ? `Scanning: ${progress.found} found, ${progress.measured} measured, ${progress.waiting} waiting to be measured.` : `Scan finished: ${progress.found} found, ${progress.measured} measured.`, bold: true },
    '',
  ];
  const sorted = [...progress.running].sort((a, b) => a.startedAt - b.startedAt);
  for (const kind of ['scan', 'measure'] as const) {
    const list = sorted.filter((a) => a.kind === kind);
    if (!list.length) continue;
    lines.push({ text: kind === 'scan' ? 'Plugins still looking for items' : 'Folders being measured', bold: true });
    for (const a of list) {
      lines.push(`  ${elapsed(now - a.startedAt).padStart(8)}  ${a.label}`);
      if (a.detail) lines.push(`            ${tildify(a.detail)}`);
    }
    lines.push('');
  }
  if (!progress.running.length) lines.push(scanning ? 'Starting…' : 'Nothing is running.');
  return lines;
}

export function ActivityDialog({ screen, progress, scanning, offset }: { screen: Screen; progress: ScanProgress; scanning: boolean; offset: number }) {
  const { theme } = useLook();
  const size = dialogSize(screen);
  const rows = dialogRows(screen);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const lines = activityLines(progress, scanning, now);
  return (
    <Overlay title="Scan progress" context="activity" screen={screen} {...size} color={theme.muted} bottomTitle={scrolledRange(lines.length, offset, rows)}>
      <Scrolled lines={lines} offset={offset} rows={rows} width={size.width - 4} />
    </Overlay>
  );
}

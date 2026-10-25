import { useEffect, useReducer, useRef, useState } from 'react';
import { type Plugin, type ScanContext, type ScanLogEntry, type ScanProgress, type Target } from '../../../domain/types.ts';
import { scanAll } from '../../../application/scan.ts';
import type { Estimate } from '../../../domain/types.ts';

const LOG_LIMIT = 200;

interface ScanState {
  targets: React.RefObject<Target[]>;
  version: number;
  bump: () => void;
  scanning: boolean;
  progress: ScanProgress;
  measured: React.RefObject<Set<number>>;
  logFor: (plugin: string, targetId?: number) => ScanLogEntry[];
  rescan: () => void;
  abort: () => void;
}

interface ScanOptions {
  estimates?: Map<string, Estimate>;
  onScanned?: (targets: Target[]) => void;
}

export function useScan(plugins: Plugin[], ctx: Omit<ScanContext, 'signal'>, minAge: React.RefObject<number>, onWarning: (text: string) => void, options: ScanOptions = {}): ScanState {
  const targets = useRef<Target[]>([]);
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const [generation, setGeneration] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [progress, setProgress] = useState<ScanProgress>({ running: [], found: 0, measured: 0, waiting: 0 });
  const logs = useRef(new Map<string, ScanLogEntry[]>());
  const measured = useRef(new Set<number>());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const buffer: Target[] = [];
    targets.current = [];
    setScanning(true);
    bump();
    const flush = () => {
      if (!buffer.length) return;
      targets.current.push(...buffer.splice(0));
      bump();
    };
    const timer = setInterval(flush, 200);
    let changed = false;
    const tick = setInterval(() => changed && ((changed = false), bump()), 200);
    let latest: ScanProgress | undefined;
    const progressTick = setInterval(() => latest && (setProgress(latest), (latest = undefined)), 500);
    logs.current = new Map();
    measured.current = new Set();
    const onLog = (entry: ScanLogEntry) => {
      for (const plugin of entry.plugins) {
        const list = logs.current.get(plugin) ?? [];
        list.push(entry);
        if (list.length > LOG_LIMIT) list.splice(0, list.length - LOG_LIMIT);
        logs.current.set(plugin, list);
      }
    };
    const onMeasured = (t: Target) => {
      measured.current.add(t.id);
      changed = true;
    };
    scanAll(plugins, { ...ctx, olderThan: minAge.current, signal: controller.signal }, onMeasured, onWarning, { onFound: (t) => buffer.push(t), onProgress: (p) => (latest = p), onLog, estimates: options.estimates }).finally(() => {
      clearInterval(tick);
      clearInterval(progressTick);
      if (latest) setProgress(latest);
      if (controller.signal.aborted) return;
      clearInterval(timer);
      flush();
      bump();
      setScanning(false);
      options.onScanned?.(targets.current);
    });
    return () => {
      controller.abort();
      clearInterval(timer);
      clearInterval(tick);
      clearInterval(progressTick);
    };
  }, [generation]);

  const logFor = (plugin: string, targetId?: number) => (logs.current.get(plugin) ?? []).filter((e) => targetId === undefined || e.targetId === undefined || e.targetId === targetId);
  return { targets, version, bump, scanning, progress, measured, logFor, rescan: () => setGeneration((g) => g + 1), abort: () => abortRef.current?.abort() };
}

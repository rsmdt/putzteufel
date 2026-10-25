import { useEffect, useReducer, useRef, useState } from 'react';
import { type Plugin, type ScanContext, type ScanProgress, type ScanStep, type Target } from '../../../domain/types.ts';
import { scanAll } from '../../../application/scan.ts';
import type { Estimate } from '../../../domain/types.ts';

const STEP_LIMIT = 200;

interface ScanState {
  targets: React.RefObject<Target[]>;
  version: number;
  bump: () => void;
  scanning: boolean;
  progress: ScanProgress;
  measured: React.RefObject<Set<number>>;
  stepsFor: (plugin: string, targetId?: number) => ScanStep[];
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
  const steps = useRef(new Map<string, Map<string, ScanStep>>());
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
    steps.current = new Map();
    measured.current = new Set();
    const onStep = (step: ScanStep) => {
      for (const plugin of step.plugins) {
        const list = steps.current.get(plugin) ?? new Map<string, ScanStep>();
        list.set(step.id, step);
        if (list.size > STEP_LIMIT) list.delete(list.keys().next().value!);
        steps.current.set(plugin, list);
      }
    };
    const onMeasured = (t: Target) => {
      measured.current.add(t.id);
      changed = true;
    };
    scanAll(plugins, { ...ctx, olderThan: minAge.current, signal: controller.signal }, onMeasured, onWarning, { onFound: (t) => buffer.push(t), onProgress: (p) => (latest = p), onStep, estimates: options.estimates }).finally(() => {
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

  const stepsFor = (plugin: string, targetId?: number) => [...(steps.current.get(plugin)?.values() ?? [])].filter((s) => targetId === undefined || s.targetId === undefined || s.targetId === targetId);
  return { targets, version, bump, scanning, progress, measured, stepsFor, rescan: () => setGeneration((g) => g + 1), abort: () => abortRef.current?.abort() };
}

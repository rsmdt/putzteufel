import { useEffect, useReducer, useRef, useState } from 'react';
import type { Plugin, ScanContext, Target } from '../../core/index.ts';
import { scanAll } from '../../engine/scan.ts';

export interface ScanState {
  targets: React.RefObject<Target[]>;
  version: number;
  bump: () => void;
  scanning: boolean;
  rescan: () => void;
  abort: () => void;
}

export function useScan(plugins: Plugin[], ctx: Omit<ScanContext, 'signal'>, minAge: React.RefObject<number>, onWarning: (text: string) => void): ScanState {
  const targets = useRef<Target[]>([]);
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const [generation, setGeneration] = useState(0);
  const [scanning, setScanning] = useState(true);
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
    scanAll(plugins, { ...ctx, olderThan: minAge.current, signal: controller.signal }, (t) => buffer.push(t), onWarning).finally(() => {
      if (controller.signal.aborted) return;
      clearInterval(timer);
      flush();
      setScanning(false);
    });
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [generation]);

  return { targets, version, bump, scanning, rescan: () => setGeneration((g) => g + 1), abort: () => abortRef.current?.abort() };
}

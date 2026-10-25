import type { Step } from '../../../domain/run-plan.ts';
import type { StepState } from '../../../domain/types.ts';
import type { Icons, Theme } from '../theme.ts';
import type { Line } from './explain.ts';

export interface LogStep {
  state: StepState;
  title: string;
  detail?: string;
  startedAt?: number;
  endedAt?: number;
}

const RUN_STATES: Record<Step['state'], StepState> = { pending: 'queued', running: 'running', done: 'done', failed: 'failed', skipped: 'stopped' };

export function duration(ms: number): string {
  const s = ms / 1000;
  if (s < 10) return `${s.toFixed(1)}s`;
  if (s < 60) return `${Math.floor(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
}

export function infoLines(lines: Line[], theme: Theme): Line[] {
  return lines.map((line) =>
    typeof line === 'string' ? { text: `[INFO] ${line}` } : { ...line, text: `${line.fg === theme.warn ? '[WARN]' : '[INFO]'} ${line.text}` },
  );
}

export function runLogSteps(steps: Step[]): LogStep[] {
  return steps.map((s) => {
    const verb = s.kind === 'item' ? (s.state === 'pending' ? 'Waiting to clean' : s.state === 'running' ? 'Cleaning' : s.state === 'done' ? 'Cleaned' : s.state === 'failed' ? 'Could not clean' : 'Skipped cleaning') : '';
    const what = verb ? `${verb} ${s.label}` : s.label;
    const progress = s.state === 'running' && s.progress !== undefined ? ` · ${Math.round(s.progress * 100)}%` : '';
    const running = s.state === 'running';
    return { state: RUN_STATES[s.state], title: `${what}${!running && s.detail ? `: ${s.detail}` : ''}${progress}`, detail: running ? s.detail : undefined, startedAt: s.startedAt, endedAt: s.endedAt };
  });
}

export function stepLines(steps: LogStep[], spinner: string, icons: Icons, theme: Theme, now = Date.now()): Line[] {
  return steps.flatMap((step): Line[] => {
    const took = step.startedAt === undefined ? '' : ` · ${duration((step.endedAt ?? now) - step.startedAt)}`;
    switch (step.state) {
      case 'queued':
        return [{ text: `${icons.waiting} ${step.title}`, fg: theme.muted }];
      case 'running':
        return [{ text: `${spinner} ${step.title}${took}`, fg: theme.accent }, ...(step.detail ? [{ text: `    ${step.detail}`, fg: theme.muted }] : [])];
      case 'done':
        return [{ text: `${icons.done} ${step.title}${took}`, fg: theme.ok }];
      case 'failed':
        return [{ text: `${icons.failed} ${step.title}${took}`, fg: theme.error }];
      case 'stopped':
        return [{ text: `${icons.skipped} ${step.title}${took}`, fg: theme.warn }];
    }
  });
}

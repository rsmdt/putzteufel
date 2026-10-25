import { useRef, useState } from 'react';
import { type Operation } from '../../../infrastructure/oplog.ts';
import { type Decision, type RunPlan, type Step, planSteps } from '../../../domain/run-plan.ts';
import { type RunResult, runClean } from '../../../application/clean.ts';

interface Failure {
  step: Step;
  error: string;
}

interface CleanRun {
  steps: Step[];
  finishedOrder: string[];
  failure?: Failure;
  done: boolean;
  freed: number;
  start: (plan: RunPlan, onFinish: (result: RunResult) => void) => void;
  decide: (decision: Decision) => void;
  reset: () => void;
}

export function useCleanRun(onOperation: (operation: Operation) => void): CleanRun {
  const [steps, setSteps] = useState<Step[]>([]);
  const [finishedOrder, setFinishedOrder] = useState<string[]>([]);
  const [failure, setFailure] = useState<Failure | undefined>();
  const [done, setDone] = useState(false);
  const [freed, setFreed] = useState(0);
  const resolver = useRef<((d: Decision) => void) | null>(null);

  const start = (plan: RunPlan, onFinish: (result: RunResult) => void) => {
    setSteps(planSteps(plan));
    setFinishedOrder([]);
    setDone(false);
    setFreed(0);
    runClean(plan, {
      onStep: (step) => {
        setSteps((all) => all.map((s) => (s.id === step.id ? step : s)));
        if (step.state === 'done' || step.state === 'failed' || step.state === 'skipped') setFinishedOrder((order) => [...order.filter((id) => id !== step.id), step.id]);
        if (step.kind === 'item' && step.state === 'done') setFreed((n) => n + (step.bytes ?? 0));
      },
      onOperation,
      onFailure: (step, error) =>
        new Promise<Decision>((resolve) => {
          resolver.current = resolve;
          setFailure({ step, error });
        }),
    }).then((result) => {
      setFreed(result.freed);
      setDone(true);
      onFinish(result);
    });
  };

  const decide = (decision: Decision) => {
    resolver.current?.(decision);
    resolver.current = null;
    setFailure(undefined);
  };

  const reset = () => {
    setSteps([]);
    setFinishedOrder([]);
    setDone(false);
    setFreed(0);
  };

  return { steps, finishedOrder, failure, done, freed, start, decide, reset };
}

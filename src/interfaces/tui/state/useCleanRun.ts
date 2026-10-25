import { useRef, useState } from 'react';
import { type Operation } from '../../../infrastructure/oplog.ts';
import { type RunPlan, type Step, planSteps } from '../../../domain/run-plan.ts';
import { type RunResult, runClean } from '../../../application/clean.ts';

interface CleanRun {
  steps: Step[];
  active: boolean;
  stopping: boolean;
  stepFor: (targetId: number) => Step | undefined;
  start: (plan: RunPlan, onFinish: (result: RunResult) => void) => void;
  abort: () => void;
  reset: () => void;
}

export function useCleanRun(onOperation: (operation: Operation) => void): CleanRun {
  const [steps, setSteps] = useState<Step[]>([]);
  const [active, setActive] = useState(false);
  const [stopping, setStopping] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const start = (plan: RunPlan, onFinish: (result: RunResult) => void) => {
    const latest = new Map(planSteps(plan).map((s) => [s.id, s]));
    setSteps([...latest.values()]);
    setActive(true);
    setStopping(false);
    controller.current = new AbortController();
    const onStep = (step: Step) => {
      latest.set(step.id, step);
      setSteps((all) => all.map((s) => (s.id === step.id ? step : s)));
    };
    runClean(plan, { onStep, onOperation }, controller.current.signal)
      .catch((e: Error): RunResult => ({ freed: 0, cleaned: new Set(), aborted: true, steps: [...latest.values()], error: e.message }))
      .then((result) => {
        setActive(false);
        setStopping(false);
        onFinish(result);
      });
  };

  const abort = () => {
    setStopping(true);
    controller.current?.abort();
  };

  const reset = () => setSteps([]);

  const stepFor = (targetId: number) => steps.find((s) => s.id === `item:${targetId}`);

  return { steps, active, stopping, stepFor, start, abort, reset };
}

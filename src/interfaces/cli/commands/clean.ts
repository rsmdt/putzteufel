import { stepJson } from '../serialize.ts';
import { exactFreed } from '../../../infrastructure/measure.ts';
import { human } from '../../../domain/format.ts';
import { logOperation } from '../../../infrastructure/oplog.ts';
import { runClean } from '../../../application/clean.ts';
import { type Values, failurePolicy } from '../args.ts';
import { type Output } from '../output.ts';
import { planFrom, printPlan } from './plan.ts';

export const NEEDS_CONFIRMATION = 3;
const SOME_FAILED = 2;

export async function cleanCommand(values: Values, roots: string[], out: Output): Promise<number> {
  const policy = failurePolicy(values['on-failure'] ?? 'skip');
  const { plan } = await planFrom(values, roots, out);
  if (!values.yes) {
    const exact = await exactFreed(plan.items.filter((i) => i.how !== 'covered').flatMap((i) => i.target.paths));
    printPlan(plan, out, exact);
    out.line('\nNothing was removed. Run the same command with --yes to clean.');
    out.event('confirmation-required', { message: 'add --yes to clean', items: plan.items.map((i) => i.target.key) });
    return NEEDS_CONFIRMATION;
  }
  if (!plan.items.length) {
    out.line('Nothing selected.');
    out.event('done', { freed: 0, cleaned: [], aborted: false, failed: 0 });
    return 0;
  }
  const byId = new Map(plan.run.targets.map((t) => [t.id, t]));
  const writes: Promise<void>[] = [];
  const attempts = new Map<string, number>();
  const icon = { pending: '·', running: '…', done: '✓', failed: '✗', skipped: '↷' };
  const result = await runClean(plan.run, {
    onStep: (step) => {
      out.event('step', { step: stepJson(step, byId) });
      if (step.state !== 'running' && step.state !== 'pending') out.line(`${icon[step.state]} ${step.label}${step.detail ? `  ${step.detail}` : ''}`);
    },
    onFailure: async (step, error) => {
      const attempt = (attempts.get(step.id) ?? 0) + 1;
      attempts.set(step.id, attempt);
      const decision = policy.decide(attempt);
      out.event('failure', { step: stepJson(step, byId), error, decision, attempt });
      return decision;
    },
    onOperation: (operation) => void writes.push(logOperation(operation)),
  });
  await Promise.all(writes);
  const failed = result.steps.filter((s) => s.state === 'failed').length;
  out.event('done', { freed: result.freed, cleaned: [...result.cleaned].map((id) => byId.get(id)?.key), aborted: result.aborted, failed });
  out.line(`\nFreed about ${human(result.freed)}: ${result.cleaned.size} of ${plan.items.length} item(s) cleaned${failed ? `, ${failed} step(s) failed` : ''}${result.aborted ? ', aborted' : ''}.`);
  return failed || result.aborted ? SOME_FAILED : 0;
}

import { type Decision, type RunPlan, type Step, type StepState, actionFor, planSteps, summarize, uninstallList } from '../domain/run-plan.ts';
import { type Target } from '../domain/types.ts';
import { type Operation } from '../infrastructure/oplog.ts';
import { cleanTarget } from '../infrastructure/remove.ts';
import { describeCommand } from '../domain/command.ts';
import { shell } from '../infrastructure/shell.ts';
import { installTool, uninstallTool } from './tools.ts';
import { tildify } from '../domain/paths.ts';
import { coveredIn } from '../domain/overlap.ts';

interface RunEvents {
  onStep?: (step: Step) => void;
  onFailure?: (step: Step, error: string) => Promise<Decision>;
  onOperation?: (operation: Operation) => void;
}

export interface RunResult {
  freed: number;
  cleaned: Set<number>;
  aborted: boolean;
  steps: Step[];
  error?: string;
}

const PROGRESS_INTERVAL = 100;

function errorText(e: Error & { stderr?: string }): string {
  return (e.stderr || e.message).trim().slice(-400);
}

export async function runClean(plan: RunPlan, events: RunEvents = {}, signal?: AbortSignal): Promise<RunResult> {
  const steps = planSteps(plan);
  const result: RunResult = { freed: 0, cleaned: new Set(), aborted: false, steps };
  const byId = new Map(steps.map((s) => [s.id, s]));
  const update = (id: string, state: StepState, detail?: string) => {
    const step = byId.get(id);
    if (!step) return;
    step.state = state;
    step.detail = detail;
    step.progress = undefined;
    if (state === 'running') {
      step.startedAt = Date.now();
      step.endedAt = undefined;
    } else if (state !== 'pending') step.endedAt = Date.now();
    events.onStep?.({ ...step });
  };
  const progressOf = (id: string) => {
    let last = 0;
    return (fraction: number) => {
      const step = byId.get(id);
      if (!step || Date.now() - last < PROGRESS_INTERVAL) return;
      last = Date.now();
      step.progress = fraction;
      events.onStep?.({ ...step });
    };
  };
  const runHook = async (id: string, command?: string, timeout?: number): Promise<boolean> => {
    if (!command) return true;
    update(id, 'running');
    return shell(command, undefined, timeout).then(
      () => (update(id, 'done'), true),
      (e: Error & { stderr?: string }) => (update(id, 'failed', errorText(e)), false),
    );
  };
  const skipRest = (detail: string) => steps.filter((s) => s.state === 'pending' && s.kind !== 'uninstall' && s.id !== 'hook:after').forEach((s) => update(s.id, 'skipped', detail));

  if (!(await runHook('hook:before', plan.hooks.before))) {
    steps.filter((s) => s.state === 'pending').forEach((s) => update(s.id, 'skipped', 'the before hook failed, nothing was removed'));
    result.aborted = true;
    return result;
  }

  signal?.addEventListener('abort', () => (result.aborted = true));
  const installed = new Set<string>();
  for (const tool of plan.install) {
    const id = `install:${tool.bin}`;
    if (result.aborted) break;
    update(id, 'running', tool.install);
    const outcome = await installTool(tool, signal);
    if (outcome.ok) installed.add(tool.bin);
    update(id, outcome.ok ? 'done' : 'failed', outcome.error);
  }

  const covered = coveredIn(plan.targets);
  let skipAll = false;
  const groups = new Map<string, Target[]>();
  for (const t of plan.targets) groups.set(t.plugin, [...(groups.get(t.plugin) ?? []), t]);
  for (const [plugin, targets] of groups) {
    if (result.aborted) break;
    if (!(await runHook(`hook:before:${plugin}`, targets[0].hooks?.before))) {
      targets.forEach((t) => update(`item:${t.id}`, 'skipped', `${plugin} before hook failed`));
      update(`hook:after:${plugin}`, 'skipped');
      continue;
    }
    for (const t of targets) {
      if (result.aborted) break;
      const id = `item:${t.id}`;
      const record = (state: Operation['result'], detail?: string, extra: Partial<Operation> = {}) =>
        events.onOperation?.({ at: new Date().toISOString(), plugin: t.plugin, item: t.item, label: t.label, result: state, detail, ...extra });
      const cover = covered.get(t.id);
      if (cover) {
        update(id, 'skipped', `inside ${cover.plugin} ${tildify(cover.label)}, cleaned there`);
        record('skipped', `inside ${cover.plugin} ${cover.label}`);
        continue;
      }
      if (t.tool && plan.install.some((x) => x.bin === t.tool!.bin) && !installed.has(t.tool.bin)) {
        update(id, 'skipped', `${t.tool.bin} could not be installed`);
        record('skipped', `${t.tool.bin} could not be installed`);
        continue;
      }
      const action = actionFor(t, installed);
      const commands = action.kind === 'commands' ? action.commands : [];
      for (;;) {
        update(id, 'running', commands.map((c) => describeCommand(c, plan.minAge)).join('; ') || undefined);
        const outcome = await cleanTarget({ ...t, commands }, { useTrash: plan.useTrash, trashAvailable: plan.trashAvailable, minAge: plan.minAge }, signal, progressOf(id));
        const detail = { commands: commands.map((c) => describeCommand(c, plan.minAge)), paths: outcome.disposed, bytes: t.size };
        if (!outcome.errors.length) {
          result.freed += t.size ?? 0;
          result.cleaned.add(t.id);
          update(id, 'done', summarize(action, outcome.disposed, plan.minAge));
          record('done', undefined, detail);
          break;
        }
        const error = outcome.errors.join('; ');
        update(id, 'failed', error);
        record('failed', error, detail);
        if (result.aborted) break;
        const decision: Decision = skipAll || !events.onFailure ? 'skip' : await events.onFailure({ ...byId.get(id)! }, error);
        if (decision === 'retry') continue;
        if (decision === 'skipAll') skipAll = true;
        if (decision === 'abort') {
          result.aborted = true;
          skipRest('aborted');
        }
        break;
      }
    }
    if (!result.aborted) await runHook(`hook:after:${plugin}`, targets[0].hooks?.after);
  }
  if (result.aborted) skipRest('aborted');

  if (plan.uninstallAfter) {
    for (const tool of uninstallList(plan)) {
      const id = `uninstall:${tool.bin}`;
      if (!installed.has(tool.bin) && !plan.installedEarlier?.some((t) => t.bin === tool.bin)) {
        update(id, 'skipped', 'was not installed by putzteufel');
        continue;
      }
      update(id, 'running');
      const outcome = await uninstallTool(tool);
      update(id, outcome.ok ? 'done' : 'failed', outcome.error);
    }
  }
  await runHook('hook:after', plan.hooks.after);
  return result;
}

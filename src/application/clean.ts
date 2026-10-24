import { type Decision, type RunPlan, type Step, type StepState, actionFor, planSteps, summarize } from '../domain/run-plan.ts';
import { type Target } from '../domain/types.ts';
import { type Operation } from '../infrastructure/oplog.ts';
import { cleanTarget } from '../infrastructure/remove.ts';
import { describeCommand } from '../domain/command.ts';
import { forgetWhich, shell, which } from '../infrastructure/shell.ts';
import { tildify } from '../domain/paths.ts';
import { coveredIn } from '../domain/overlap.ts';

export const INSTALL_TIMEOUT = 30 * 60_000;

export interface RunEvents {
  onStep?: (step: Step) => void;
  onFailure?: (step: Step, error: string) => Promise<Decision>;
  onOperation?: (operation: Operation) => void;
}

export interface RunResult {
  freed: number;
  cleaned: Set<number>;
  aborted: boolean;
  steps: Step[];
}

function errorText(e: Error & { stderr?: string }): string {
  return (e.stderr || e.message).trim().slice(-400);
}

export async function runClean(plan: RunPlan, events: RunEvents = {}): Promise<RunResult> {
  const steps = planSteps(plan);
  const result: RunResult = { freed: 0, cleaned: new Set(), aborted: false, steps };
  const byId = new Map(steps.map((s) => [s.id, s]));
  const update = (id: string, state: StepState, detail?: string) => {
    const step = byId.get(id);
    if (!step) return;
    step.state = state;
    step.detail = detail;
    events.onStep?.({ ...step });
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

  const installed = new Set<string>();
  for (const tool of plan.install) {
    const id = `install:${tool.bin}`;
    if (!(await runHook(id, tool.install, INSTALL_TIMEOUT))) continue;
    forgetWhich();
    if (await which(tool.bin)) installed.add(tool.bin);
    else update(id, 'failed', `finished, but ${tool.bin} is still not on PATH`);
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
        update(id, 'running');
        const outcome = await cleanTarget({ ...t, commands }, { useTrash: plan.useTrash, trashAvailable: plan.trashAvailable, minAge: plan.minAge });
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

  if (plan.uninstallAfter) {
    for (const tool of plan.install.filter((t) => t.uninstall)) {
      const id = `uninstall:${tool.bin}`;
      if (!installed.has(tool.bin)) {
        update(id, 'skipped', 'was not installed by this run');
        continue;
      }
      await runHook(id, tool.uninstall, INSTALL_TIMEOUT);
    }
    forgetWhich();
  }
  await runHook('hook:after', plan.hooks.after);
  return result;
}

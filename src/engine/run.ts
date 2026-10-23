import { type Command, type Hooks, type Target, type Tool, cleanTarget, forgetWhich, shell, tildify, which } from '../core/index.ts';
import { coveredIn } from './overlap.ts';

export const INSTALL_TIMEOUT = 30 * 60_000;

export interface RunPlan {
  targets: Target[];
  install: Tool[];
  uninstallAfter: boolean;
  hooks: Hooks;
  useTrash: boolean;
}

export type StepKind = 'hook' | 'install' | 'item' | 'uninstall';
export type StepState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface Step {
  id: string;
  kind: StepKind;
  label: string;
  state: StepState;
  detail?: string;
  bytes?: number;
}

export type Decision = 'retry' | 'skip' | 'skipAll' | 'abort';

export interface RunEvents {
  onStep?: (step: Step) => void;
  onFailure?: (step: Step, error: string) => Promise<Decision>;
}

export interface RunResult {
  freed: number;
  cleaned: Set<number>;
  aborted: boolean;
  steps: Step[];
}

export function missingTools(targets: Target[]): Tool[] {
  const tools = new Map<string, Tool>();
  for (const t of targets) if (t.tool && !t.tool.installed && !t.tool.broken && t.tool.install && !tools.has(t.tool.bin)) tools.set(t.tool.bin, t.tool);
  return [...tools.values()];
}

export type Action = { kind: 'commands'; commands: Command[]; afterInstall?: string } | { kind: 'delete'; missing?: string };

export function actionFor(t: Target, install: Set<string>): Action {
  if (t.commands.length) return { kind: 'commands', commands: t.commands };
  if (t.tool && !t.tool.installed && install.has(t.tool.bin)) return { kind: 'commands', commands: t.tool.clean, afterInstall: t.tool.install };
  return { kind: 'delete', missing: t.tool && !t.tool.installed && t.tool.clean.length ? t.tool.bin : undefined };
}

export function summarize(action: Action, t: Target, useTrash: boolean): string {
  if (action.kind === 'commands') return `Ran ${action.commands.map((c) => c.run).join(' && ')}`;
  const count = t.paths.length;
  return `${useTrash ? 'Moved' : 'Deleted'} ${count} ${count === 1 ? 'folder' : 'folders'}${useTrash ? ' to the Trash' : ''}`;
}

function errorText(e: Error & { stderr?: string }): string {
  return (e.stderr || e.message).trim().slice(-400);
}

export function planSteps(plan: RunPlan): Step[] {
  const steps: Step[] = [];
  const hook = (id: string, label: string, command?: string) => command && steps.push({ id, kind: 'hook', label: `${label}: ${command}`, state: 'pending' });
  hook('hook:before', 'before hook', plan.hooks.before);
  for (const tool of plan.install) steps.push({ id: `install:${tool.bin}`, kind: 'install', label: `install ${tool.bin}: ${tool.install}`, state: 'pending' });
  const seen = new Set<string>();
  for (const t of plan.targets) {
    if (!seen.has(t.plugin)) {
      seen.add(t.plugin);
      hook(`hook:before:${t.plugin}`, `${t.plugin} before hook`, t.hooks?.before);
    }
    steps.push({ id: `item:${t.id}`, kind: 'item', label: tildify(t.label), state: 'pending', bytes: t.size });
    const last = plan.targets.filter((x) => x.plugin === t.plugin).at(-1);
    if (last === t) hook(`hook:after:${t.plugin}`, `${t.plugin} after hook`, t.hooks?.after);
  }
  if (plan.uninstallAfter) for (const tool of plan.install.filter((t) => t.uninstall)) steps.push({ id: `uninstall:${tool.bin}`, kind: 'uninstall', label: `uninstall ${tool.bin}: ${tool.uninstall}`, state: 'pending' });
  hook('hook:after', 'after hook', plan.hooks.after);
  return steps;
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
      const cover = covered.get(t.id);
      if (cover) {
        update(id, 'skipped', `inside ${cover.plugin} ${tildify(cover.label)}, cleaned there`);
        continue;
      }
      if (t.tool && plan.install.some((x) => x.bin === t.tool!.bin) && !installed.has(t.tool.bin)) {
        update(id, 'skipped', `${t.tool.bin} could not be installed`);
        continue;
      }
      const action = actionFor(t, installed);
      for (;;) {
        update(id, 'running');
        const failures = await cleanTarget({ ...t, commands: action.kind === 'commands' ? action.commands : [] }, plan.useTrash);
        if (!failures.length) {
          result.freed += t.size ?? 0;
          result.cleaned.add(t.id);
          update(id, 'done', summarize(action, t, plan.useTrash));
          break;
        }
        const error = failures.join('; ');
        update(id, 'failed', error);
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

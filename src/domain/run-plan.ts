import { type Command, type Hooks, type Target, type Tool } from './types.ts';
import { type Disposed } from './disposal.ts';
import { describeCommand } from './command.ts';
import { tildify } from './paths.ts';

export interface RunPlan {
  targets: Target[];
  install: Tool[];
  installedEarlier?: Tool[];
  uninstallAfter: boolean;
  hooks: Hooks;
  useTrash: boolean;
  trashAvailable: boolean;
  minAge?: number;
}

type StepKind = 'hook' | 'install' | 'item' | 'uninstall';

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

const folders = (n: number) => `${n} ${n === 1 ? 'folder' : 'folders'}`;

export function summarize(action: Action, disposed: Disposed[], minAge = 0): string {
  if (action.kind === 'commands') return `Ran ${action.commands.map((c) => describeCommand(c, minAge)).join(' && ')}`;
  const trashed = disposed.filter((d) => d.how === 'trash').length;
  const deleted = disposed.length - trashed;
  const parts = [...(deleted ? [`Deleted ${folders(deleted)}`] : []), ...(trashed ? [`Moved ${folders(trashed)} to the Trash`] : [])];
  return parts.join(', ') || 'Nothing left to remove';
}

export function uninstallList(plan: RunPlan): Tool[] {
  const all = [...plan.install, ...(plan.installedEarlier ?? [])].filter((t) => t.uninstall);
  return all.filter((t, i) => all.findIndex((x) => x.bin === t.bin) === i);
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
  if (plan.uninstallAfter) for (const tool of uninstallList(plan)) steps.push({ id: `uninstall:${tool.bin}`, kind: 'uninstall', label: `uninstall ${tool.bin}: ${tool.uninstall}`, state: 'pending' });
  hook('hook:after', 'after hook', plan.hooks.after);
  return steps;
}

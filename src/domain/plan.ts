import { type Disposal, disposalFor } from './disposal.ts';
import { type Hooks, type Target, type Tool } from './types.ts';
import { describeCommand } from './command.ts';
import { coveredIn, uniqueSize } from './overlap.ts';
import { type RunPlan, actionFor, missingTools } from './run-plan.ts';

export type InstallChoice = 'all' | 'none' | string[];

interface PlanOptions {
  useTrash: boolean;
  trashAvailable: boolean;
  install: InstallChoice;
  uninstallAfter: boolean;
  hooks: Hooks;
  minAge: number;
}

interface PlanNote {
  level: 'info' | 'warn' | 'error';
  text: string;
}

interface PlannedItem {
  target: Target;
  how: 'commands' | 'delete' | 'covered';
  commands: string[];
  afterInstall?: string;
  missingTool?: string;
  paths: { path: string; how: Disposal }[];
  coveredBy?: Target;
}

export interface Plan {
  items: PlannedItem[];
  install: Tool[];
  uninstall: Tool[];
  hooks: Hooks;
  notes: PlanNote[];
  size: number;
  run: RunPlan;
}

function chosenTools(selected: Target[], choice: InstallChoice): Tool[] {
  const missing = missingTools(selected);
  if (choice === 'all') return missing;
  if (choice === 'none') return [];
  return missing.filter((t) => choice.includes(t.bin));
}

export function planNotes(selected: Target[], options: Pick<PlanOptions, 'useTrash' | 'trashAvailable'>, installing: Set<string>): PlanNote[] {
  const removed = selected.filter((t) => actionFor(t, installing).kind === 'delete' && t.paths.length);
  const permanent = removed.flatMap((t) => t.paths.filter((p) => disposalFor(t, p, options) === 'delete'));
  const notes: PlanNote[] = [];
  if (!options.trashAvailable && permanent.length) notes.push({ level: 'error', text: `The Trash is not available here: ${permanent.length} folder(s) will be deleted permanently and cannot be recovered.` });
  else if (permanent.length) notes.push({ level: 'error', text: `No Trash: ${permanent.length} folder(s) will be deleted permanently and cannot be recovered. Use Trash mode to keep them recoverable.` });
  if (options.trashAvailable && !options.useTrash && removed.some((t) => t.impact === 'dataloss')) notes.push({ level: 'warn', text: 'Data loss folders go to the Trash even in delete mode.' });
  for (const t of selected.filter((x) => x.impact === 'dataloss' && actionFor(x, installing).kind === 'commands')) notes.push({ level: 'error', text: `${t.plugin} / ${t.item ?? t.label} runs a command; what it removes cannot go to the Trash.` });
  return notes;
}

export function makePlan(selected: Target[], options: PlanOptions): Plan {
  const install = chosenTools(selected, options.install);
  const installing = new Set(install.map((t) => t.bin));
  const covered = coveredIn(selected);
  const items = selected.map((target): PlannedItem => {
    const coveredBy = covered.get(target.id);
    if (coveredBy) return { target, how: 'covered', commands: [], paths: [], coveredBy };
    const action = actionFor(target, installing);
    if (action.kind === 'commands') return { target, how: 'commands', commands: action.commands.map((c) => describeCommand(c, options.minAge)), afterInstall: action.afterInstall, paths: [] };
    return { target, how: 'delete', commands: [], missingTool: action.missing, paths: target.paths.map((p) => ({ path: p, how: disposalFor(target, p, options) })) };
  });
  return {
    items,
    install,
    uninstall: options.uninstallAfter ? install.filter((t) => t.uninstall) : [],
    hooks: options.hooks,
    notes: planNotes(selected, options, installing),
    size: uniqueSize(selected),
    run: { targets: selected, install, uninstallAfter: options.uninstallAfter, hooks: options.hooks, useTrash: options.useTrash, trashAvailable: options.trashAvailable, minAge: options.minAge },
  };
}

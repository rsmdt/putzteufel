import { type Hooks, IMPACTS, IMPACT_ORDER, type Target, describeCommand, human, isRecent, tildify } from '../../core/index.ts';
import { coveredIn, uniqueSize } from '../../engine/overlap.ts';
import { actionFor, missingTools } from '../../engine/run.ts';
import type { Theme } from '../theme.ts';

export type Line = string | { text: string; fg?: string; bold?: boolean };

export function impactLines(t: Target, recentDays: number, minAge: number, theme: Theme): Line[] {
  const info = IMPACTS[t.impact];
  const color = theme.impact[t.impact];
  const lines: Line[] = [{ text: `If removed (${info.tag}): ${info.meaning}`, fg: color }];
  if (t.note) lines.push({ text: `  ${t.note}`, fg: color });
  if (!info.preselected) lines.push(`Not selected by default: ${info.tag} items are only removed when you pick them. ? explains the tags.`);
  else if (t.project !== undefined && isRecent(t, recentDays)) lines.push(`Not selected by default: the project was edited in the last ${recentDays} days.`);
  else if (isRecent(t, minAge)) lines.push(`Not selected by default: younger than the ${minAge}-day age threshold.`);
  else lines.push(`Selected by default: ${info.tag} items are recreated without losing anything.`);
  return lines;
}

export function toolLines(t: Target, theme: Theme): Line[] {
  if (!t.tool?.clean.length) return t.commands.length ? [`Cleaned by: $ ${describeCommand(t.commands[0])}`] : ['Cleaned by deleting the files listed below.'];
  if (t.tool.installed) return [`Cleaned by its own tool: $ ${describeCommand(t.tool.clean[0])}`];
  if (t.tool.broken) return [{ text: `${t.tool.bin} is installed but failed (${t.tool.broken}): its default folders are deleted directly.`, fg: theme.warn }];
  return [
    { text: `${t.tool.bin} is not installed: the folders are deleted directly.`, fg: theme.warn },
    ...(t.tool.install ? [{ text: `d offers to install it first (${t.tool.install}) and clean with $ ${t.tool.clean[0].run}`, fg: theme.warn }] : []),
  ];
}

export function legendLines(recentDays: number, theme: Theme): Line[] {
  return [
    { text: 'What the tags mean: what happens to an item after it is removed.', bold: true },
    ...IMPACT_ORDER.flatMap((impact): Line[] => {
      const info = IMPACTS[impact];
      return [{ text: `  ${info.tag.padEnd(12)} ${info.meaning}`, fg: theme.impact[impact] }, `  ${''.padEnd(12)} ${info.preselected ? 'Selected by default.' : 'Never selected by default.'}`];
    }),
    { text: `  ${'recent'.padEnd(12)} A project edited in the last ${recentDays} days, or an item younger than the [ ] age threshold.`, fg: theme.accent },
    `  ${''.padEnd(12)} Never selected by default.`,
    '',
    'The preview explains the item at the cursor. Press f to see every file before you decide.',
    'Nothing is removed until d shows the review screen and you press y.',
  ];
}

export function reviewLines(selected: Target[], useTrash: boolean, install: Set<string>, uninstallAfter: boolean, hooks: Hooks, theme: Theme): Line[] {
  const lines: Line[] = [
    { text: `${useTrash ? 'Move to Trash' : 'Permanently delete'} ${selected.length} item(s), about ${human(uniqueSize(selected))}.`, bold: true },
    'Items with a $ line run that tool command instead of deleting files. Press f on an item in the list to browse its files.',
  ];
  for (const impact of IMPACT_ORDER) {
    const group = selected.filter((t) => t.impact === impact);
    if (group.length) lines.push({ text: `  ${String(group.length).padStart(4)} ${IMPACTS[impact].tag.padEnd(12)} ${human(uniqueSize(group)).padStart(7)}  ${IMPACTS[impact].meaning}`, fg: theme.impact[impact] });
  }
  if (selected.some((t) => t.impact === 'dataloss')) lines.push({ text: 'Data loss items cannot be recovered. Check them below before pressing y.', fg: theme.impact.dataloss });
  const tools = missingTools(selected).filter((t) => install.has(t.bin));
  const steps: Line[] = [
    ...(hooks.before ? [`  before hook:  $ ${hooks.before}`] : []),
    ...tools.map((t) => ({ text: `  install:      $ ${t.install}`, fg: theme.warn })),
    ...(uninstallAfter ? tools.filter((t) => t.uninstall).map((t) => ({ text: `  then remove:  $ ${t.uninstall}  (after cleaning; dependencies brew pulled in stay)`, fg: theme.warn })) : []),
    ...(hooks.after ? [`  after hook:   $ ${hooks.after}`] : []),
  ];
  if (steps.length) lines.push('', 'Run steps:', ...steps);
  const covered = coveredIn(selected);
  if (covered.size) lines.push({ text: `${covered.size} item(s) lie inside another selected item; they are counted and cleaned once, by that item.`, fg: theme.warn });
  lines.push('');
  for (const t of [...selected].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))) {
    const notable = t.impact !== 'regenerates' && t.impact !== 'rebuild';
    lines.push({ text: `${human(t.size).padStart(7)}  ${IMPACTS[t.impact].tag.padEnd(12)} [${t.plugin}] ${tildify(t.label)}`, fg: notable ? theme.impact[t.impact] : undefined });
    const action = actionFor(t, install);
    const cover = covered.get(t.id);
    if (cover) {
      lines.push({ text: `           counted under ${cover.plugin} (${tildify(cover.label)}); skipped when that runs`, fg: theme.warn });
      continue;
    }
    if (t.hooks?.before) lines.push(`           before: $ ${t.hooks.before}`);
    if (action.kind === 'commands') for (const c of action.commands) lines.push(`           $ ${describeCommand(c)}${action.afterInstall ? '   (after install)' : ''}`);
    else {
      if (action.missing) lines.push({ text: `           ${action.missing} not installed: the folders below are deleted directly`, fg: theme.warn });
      for (const p of t.paths) if (p !== t.label || action.missing) lines.push(`           - ${tildify(p)}`);
    }
    if (t.hooks?.after) lines.push(`           after:  $ ${t.hooks.after}`);
    for (const l of t.listed) lines.push(`           · ${l}`);
  }
  return lines;
}

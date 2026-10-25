import type { Suggestion } from '../../domain/suggest.ts';
import { IMPACTS } from '../../domain/impact.ts';
import { type Target } from '../../domain/types.ts';
import { describeCommand } from '../../domain/command.ts';
import { sectionOf } from '../../domain/groups.ts';
import { type OverlapIndex } from '../../domain/overlap.ts';
import { type Step } from '../../domain/run-plan.ts';
import { type Plan } from '../../domain/plan.ts';
import { selectionReason } from '../../domain/select.ts';

export const SCHEMA_VERSION = 1;

export interface Context {
  overlap: OverlapIndex;
  recentDays: number;
  minAge: number;
}

export function targetJson(t: Target, context: Context) {
  return {
    key: t.key,
    plugin: t.plugin,
    item: t.item,
    group: t.group,
    section: sectionOf(t.group),
    label: t.label,
    paths: t.paths,
    listed: t.listed,
    size: t.size ?? null,
    linkedBytes: t.linkedBytes ?? 0,
    ageDays: t.ageDays ?? null,
    estimated: Boolean(t.estimated),
    impact: { kind: t.impact, tag: IMPACTS[t.impact].tag, meaning: IMPACTS[t.impact].meaning, preselected: IMPACTS[t.impact].preselected },
    note: t.note ?? null,
    selected: t.selected,
    selectedReason: selectionReason(t, context.recentDays, context.minAge),
    commands: t.commands.map((c) => describeCommand(c, context.minAge)),
    tool: t.tool ? { bin: t.tool.bin, installed: t.tool.installed, broken: t.tool.broken ?? null, install: t.tool.install ?? null, uninstall: t.tool.uninstall ?? null, clean: t.tool.clean.map((c) => describeCommand(c, context.minAge)) } : null,
    hooks: t.hooks ?? null,
    project: t.project ?? null,
    fallback: Boolean(t.fallback),
    sharedWith: context.overlap.sharedWith(t).map((o) => o.key),
    coveredBy: context.overlap.coveredBy(t)?.key ?? null,
  };
}

export function planJson(plan: Plan) {
  return {
    size: plan.size,
    notes: plan.notes,
    hooks: plan.hooks,
    install: plan.install.map((t) => ({ bin: t.bin, command: t.install })),
    uninstall: plan.uninstall.map((t) => ({ bin: t.bin, command: t.uninstall })),
    items: plan.items.map((i) => ({
      key: i.target.key,
      plugin: i.target.plugin,
      item: i.target.item,
      label: i.target.label,
      size: i.target.size ?? null,
      impact: i.target.impact,
      how: i.how,
      commands: i.commands,
      afterInstall: i.afterInstall ?? null,
      missingTool: i.missingTool ?? null,
      paths: i.paths,
      coveredBy: i.coveredBy?.key ?? null,
      hooks: i.target.hooks ?? null,
    })),
  };
}

export function suggestionJson(s: Suggestion) {
  return { bin: s.tool.bin, install: s.tool.install ?? null, uninstall: s.tool.uninstall ?? null, clean: s.tool.clean.map((c) => describeCommand(c)), size: s.size, items: s.targets.map((t) => t.key), reason: s.reason };
}

export function stepJson(step: Step, targets: Map<number, Target>) {
  const id = step.kind === 'item' ? Number(step.id.slice(5)) : undefined;
  return { id: step.id, kind: step.kind, label: step.label, state: step.state, detail: step.detail ?? null, bytes: step.bytes ?? null, key: id === undefined ? null : (targets.get(id)?.key ?? null) };
}

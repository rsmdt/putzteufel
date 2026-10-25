import { type Plan, makePlan } from '../../../domain/plan.ts';
import { select } from '../../../domain/select.ts';
import { planJson } from '../serialize.ts';
import { type Session, openSession } from '../../../application/session.ts';
import { type Target } from '../../../domain/types.ts';
import { exactFreed } from '../../../infrastructure/measure.ts';
import { human } from '../../../domain/format.ts';
import { tildify } from '../../../domain/paths.ts';
import { trashAvailable } from '../../../infrastructure/remove.ts';
import { type Values, installChoice, selector, sessionOptions } from '../args.ts';
import { type Output } from '../output.ts';
import { progressReporter } from '../progress.ts';
import { scanSession } from '../../../application/scan-session.ts';

interface Planned {
  session: Session;
  targets: Target[];
  plan: Plan;
}

export async function planFrom(values: Values, roots: string[], out: Output): Promise<Planned> {
  const session = await openSession(sessionOptions(values, roots));
  session.config.errors.forEach((e) => out.warn(`config: ${e}`));
  const targets = await scanSession(session, { onWarning: out.warn, onProgress: progressReporter(out, values.verbose) });
  const selected = select(targets, selector(values, session.ctx.olderThan), session.ctx.recentDays);
  const plan = makePlan(selected, {
    useTrash: values.trash,
    trashAvailable: await trashAvailable(),
    install: installChoice(values['install-tools'] ?? 'none'),
    uninstallAfter: values['uninstall-after'],
    hooks: session.config.settings.hooks,
    minAge: session.ctx.olderThan,
  });
  return { session, targets, plan };
}

export function printPlan(plan: Plan, out: Output, exact?: { total: number; freed: number }): void {
  out.line(`${plan.run.useTrash ? 'Move to Trash' : 'Permanently delete'} ${plan.items.length} item(s), about ${human(plan.size)}.`);
  if (exact) out.line(`Exactly ${human(exact.total)} on disk, each file counted once; ${human(exact.freed)} is freed.`);
  for (const note of plan.notes) out.line(`${note.level === 'error' ? '!!' : note.level === 'warn' ? ' !' : '  '} ${note.text}`);
  if (plan.hooks.before) out.line(`  before hook: $ ${plan.hooks.before}`);
  for (const t of plan.install) out.line(`  install:     $ ${t.install}`);
  for (const t of plan.uninstall) out.line(`  then remove: $ ${t.uninstall}`);
  if (plan.hooks.after) out.line(`  after hook:  $ ${plan.hooks.after}`);
  for (const i of plan.items) {
    out.line(`${human(i.target.size).padStart(7)}  ${i.target.key}  [${i.target.plugin}] ${tildify(i.target.label)}`);
    if (i.how === 'covered') out.line(`           counted under ${i.coveredBy!.plugin} (${tildify(i.coveredBy!.label)}); skipped when that runs`);
    for (const c of i.commands) out.line(`           $ ${c}${i.afterInstall ? '   (after install)' : ''}`);
    if (i.missingTool) out.line(`           ${i.missingTool} not installed: the folders below are deleted directly`);
    for (const p of i.paths) out.line(`           - ${tildify(p.path)}  ${p.how === 'trash' ? '→ Trash' : 'deleted permanently'}`);
  }
}

export async function planCommand(values: Values, roots: string[], out: Output): Promise<number> {
  const { plan } = await planFrom(values, roots, out);
  const exact = await exactFreed(plan.items.filter((i) => i.how !== 'covered').flatMap((i) => i.target.paths));
  out.event('plan', { plan: planJson(plan), exact });
  printPlan(plan, out, exact);
  return 0;
}

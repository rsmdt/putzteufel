import path from 'node:path';
import { select } from '../../../domain/select.ts';
import { suggestionJson, targetJson } from '../serialize.ts';
import { toolSuggestions } from '../../../domain/suggest.ts';
import { openSession } from '../../../application/session.ts';
import { IMPACTS } from '../../../domain/impact.ts';
import { type Target } from '../../../domain/types.ts';
import { human } from '../../../domain/format.ts';
import { tildify } from '../../../domain/paths.ts';
import { overlapIndex, uniqueSize } from '../../../domain/overlap.ts';
import { SORT_KEYS, type SortKey, sortBy, targetView } from '../../../domain/sort.ts';
import { UsageError, type Values, selector, sessionOptions } from '../args.ts';
import { type Output } from '../output.ts';
import { scanSession } from '../../../application/scan-session.ts';

function describeTarget(t: Target, cover?: Target): string {
  const age = t.ageDays === undefined ? '' : `${Math.floor(t.ageDays)}d`;
  const paths = t.paths.filter((p) => p !== t.label).map((p) => (p.startsWith(t.label + path.sep) ? path.relative(t.label, p) : tildify(p)));
  const via = t.commands.length ? `  via: ${t.commands[0].run}` : t.tool && !t.tool.installed && t.tool.clean.length ? `  ${t.tool.bin} ${t.tool.broken ? `failed (${t.tool.broken})` : 'not installed'}: deleted directly${t.tool.install && !t.tool.broken ? ` (or ${t.tool.install})` : ''}` : '';
  const shared = cover ? `  (counted under ${cover.plugin})` : '';
  const size = `${t.estimated ? '≈' : ''}${human(t.size)}`;
  return `${t.selected ? 'x' : ' '} ${size.padStart(7)} ${age.padStart(5)} ${IMPACTS[t.impact].tag.padEnd(11)}  ${t.key}  ${t.group} / ${t.plugin}${t.item && t.item !== t.label ? ` / ${t.item}` : ''}  ${tildify(t.label)}${paths.length ? `  [${paths.join(', ')}]` : ''}${via}${shared}`;
}

export async function scanCommand(values: Values, roots: string[], out: Output): Promise<number> {
  const session = await openSession(sessionOptions(values, roots));
  const minAge = session.ctx.olderThan;
  const context = (targets: Target[]) => ({ overlap: overlapIndex(targets), recentDays: session.ctx.recentDays, minAge });
  session.config.errors.forEach((e) => out.event('config-error', { message: e }));
  const found: Target[] = [];
  const suggested = new Set<string>();
  const targets = await scanSession(session, {
    onFound: (t) => out.event('found', { target: targetJson(t, context([t])) }),
    onMeasured: (t) => {
      found.push(t);
      out.event('measured', { target: targetJson(t, context([t])) });
      for (const s of toolSuggestions(found).filter((x) => !suggested.has(x.tool.bin))) {
        suggested.add(s.tool.bin);
        out.event('suggestion', { suggestion: suggestionJson(s) });
      }
    },
    onWarning: out.warn,
  });
  const chosen = new Set(select(targets, selector(values, minAge), session.ctx.recentDays).map((t) => t.id));
  targets.forEach((t) => (t.selected = chosen.has(t.id)));
  const all = context(targets);
  const selected = targets.filter((t) => t.selected);
  out.event('done', { count: targets.length, size: uniqueSize(targets), selectedSize: uniqueSize(selected), selected: selected.map((t) => t.key), targets: targets.map((t) => targetJson(t, all)) });
  if (!out.json) {
    const key = values.sort as SortKey;
    if (!SORT_KEYS.some((k) => k.key === key)) throw new UsageError(`--sort must be size, age or name; got "${values.sort}"`);
    for (const t of sortBy(targets, { key, reverse: values.reverse }, targetView)) out.line(describeTarget(t, all.overlap.coveredBy(t)));
    out.line(`${human(uniqueSize(targets))} across ${targets.length} items, ${human(uniqueSize(selected))} selected`);
    for (const s of toolSuggestions(targets)) out.line(`Suggested: ${s.reason}. Install with: putzteufel tools --install ${s.tool.bin} --yes   ($ ${s.tool.install})`);
    session.config.errors.forEach((e) => console.error(`error: ${e}`));
  }
  return 0;
}

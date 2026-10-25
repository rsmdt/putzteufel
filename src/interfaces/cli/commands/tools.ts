import { installTool } from '../../../application/tools.ts';
import { openSession } from '../../../application/session.ts';
import { scanSession } from '../../../application/scan-session.ts';
import { human } from '../../../domain/format.ts';
import { toolSuggestions } from '../../../domain/suggest.ts';
import { UsageError, type Values, sessionOptions } from '../args.ts';
import type { Output } from '../output.ts';
import { suggestionJson } from '../serialize.ts';
import { NEEDS_CONFIRMATION } from './clean.ts';

export async function toolsCommand(values: Values, roots: string[], out: Output): Promise<number> {
  const session = await openSession(sessionOptions(values, roots));
  const targets = await scanSession(session, { onWarning: out.warn });
  const suggestions = toolSuggestions(targets);
  for (const s of suggestions) {
    out.event('suggestion', { suggestion: suggestionJson(s) });
    out.line(`${s.tool.bin.padEnd(14)} ${human(s.size).padStart(7)}  $ ${s.tool.install}   ${s.reason}`);
  }
  if (!suggestions.length) out.line('No tool suggestions: every native tool putzteufel could use is installed or has no install command.');
  const wanted = values.install;
  if (!wanted) return 0;
  const chosen = wanted === 'all' ? suggestions : suggestions.filter((s) => wanted.split(',').map((b) => b.trim()).includes(s.tool.bin));
  const unknown = wanted === 'all' ? [] : wanted.split(',').filter((b) => !suggestions.some((s) => s.tool.bin === b.trim()));
  if (unknown.length) throw new UsageError(`not a suggested tool: ${unknown.join(', ')}`);
  if (!values.yes) {
    out.line(`\nWould run: ${chosen.map((s) => s.tool.install).join(' && ')}\nNothing was installed. Add --yes to install.`);
    out.event('confirmation-required', { message: 'add --yes to install', tools: chosen.map((s) => s.tool.bin) });
    return NEEDS_CONFIRMATION;
  }
  let failed = 0;
  for (const s of chosen) {
    const outcome = await installTool(s.tool);
    if (!outcome.ok) failed++;
    out.event('install', { bin: s.tool.bin, ok: outcome.ok, error: outcome.error ?? null });
    out.line(outcome.ok ? `✓ installed ${s.tool.bin}` : `✗ ${s.tool.bin}: ${outcome.error}`);
  }
  return failed ? 2 : 0;
}

import { openSession } from '../../../application/session.ts';
import { GROUP_ORDER, sectionOf } from '../../../domain/groups.ts';
import { tildify } from '../../../domain/paths.ts';
import { which } from '../../../infrastructure/shell.ts';
import { type Values, sessionOptions } from '../args.ts';
import { type Output } from '../output.ts';

export async function pluginsCommand(values: Values, out: Output): Promise<number> {
  const { config } = await openSession(sessionOptions(values, []));
  out.line(`config files: ${config.sources.map(tildify).join(', ') || 'none'}`);
  const rank = (group: string) => (GROUP_ORDER.includes(group) ? GROUP_ORDER.indexOf(group) : GROUP_ORDER.length);
  for (const def of [...config.plugins].sort((a, b) => rank(a.group) - rank(b.group) || a.name.localeCompare(b.name))) {
    const tools: { bin: string; installed: boolean; install: string | null }[] = [];
    for (const item of def.items ?? []) {
      if (item.tool && !tools.some((t) => t.bin === item.tool!.bin)) tools.push({ bin: item.tool.bin, installed: await which(item.tool.bin), install: item.tool.install ?? null });
    }
    out.event('plugin', {
      name: def.name,
      group: def.group,
      section: sectionOf(def.group),
      description: def.description ?? null,
      projects: (def.projects ?? []).map((r) => ({ name: r.name, impact: r.impact ?? 'rebuild', description: r.description ?? null })),
      items: (def.items ?? []).map((i) => ({ name: i.name, impact: i.impact ?? 'regenerates', description: i.description ?? null, requires: i.requires ?? [], fallback: Boolean(i.fallback) })),
      tools,
    });
    const parts = [...(def.projects ?? []).map((r) => `${r.name} (in projects)`), ...(def.items ?? []).map((i) => i.name)];
    const toolText = tools.map((t) => (t.installed ? t.bin : `${t.bin} not installed${t.install ? `, offers ${t.install}` : ''}`));
    out.line(`${def.group.padEnd(14)} ${def.name.padEnd(14)} ${parts.join(', ')}${toolText.length ? `  tool: ${toolText.join(', ')}` : ''}`);
  }
  config.errors.forEach((e) => {
    out.event('config-error', { message: e });
    if (!out.json) console.error(`error: ${e}`);
  });
  return config.errors.length ? 1 : 0;
}

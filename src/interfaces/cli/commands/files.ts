import { targetJson } from '../serialize.ts';
import { openSession } from '../../../application/session.ts';
import { dirEntries, entrySizes } from '../../../infrastructure/measure.ts';
import { human } from '../../../domain/format.ts';
import { tildify } from '../../../domain/paths.ts';
import { overlapIndex } from '../../../domain/overlap.ts';
import { UsageError, type Values, sessionOptions } from '../args.ts';
import { type Output } from '../output.ts';
import { scanSession } from '../../../application/scan-session.ts';

export async function filesCommand(values: Values, args: string[], out: Output): Promise<number> {
  const [key, ...roots] = args;
  if (!key) throw new UsageError('usage: putzteufel files KEY [ROOTS...] [--dir PATH] [--json]   (keys come from putzteufel scan)');
  const session = await openSession(sessionOptions(values, roots));
  const targets = await scanSession(session, { onWarning: out.warn });
  const target = targets.find((t) => t.key === key);
  if (!target) throw new UsageError(`no item with key ${key}; run putzteufel scan to see the keys`);
  const dir = values.dir;
  if (dir && !target.paths.some((p) => dir === p || dir.startsWith(`${p}/`))) throw new UsageError(`--dir must be inside one of the item's folders: ${target.paths.map(tildify).join(', ')}`);
  const entries = dir ? await dirEntries(dir) : target.paths.length === 1 ? await dirEntries(target.paths[0]) : await entrySizes(target.paths);
  const overlap = overlapIndex(targets);
  const owners = (p: string) => overlap.owners(p).filter((o) => o.id !== target.id).map((o) => o.key);
  out.event('files', {
    target: targetJson(target, { overlap, recentDays: session.ctx.recentDays, minAge: session.ctx.olderThan }),
    dir: dir ?? (target.paths.length === 1 ? target.paths[0] : null),
    entries: entries.map((e) => ({ ...e, owners: owners(e.path) })),
  });
  for (const e of entries) {
    const also = owners(e.path);
    out.line(`${human(e.size).padStart(7)}  ${e.name}${e.isDir ? '/' : ''}${also.length ? `  also: ${also.join(', ')}` : ''}`);
  }
  if (!target.paths.length) for (const line of target.listed) out.line(`  ${line}`);
  return 0;
}

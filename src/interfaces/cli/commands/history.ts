import { human } from '../../../domain/format.ts';
import { readOperations } from '../../../infrastructure/oplog.ts';
import { tildify } from '../../../domain/paths.ts';
import { type Values, number } from '../args.ts';
import { type Output } from '../output.ts';

export async function historyCommand(values: Values, out: Output): Promise<number> {
  const limit = number(values.limit, 'limit') ?? 50;
  const operations = (await readOperations()).slice(-limit);
  for (const op of operations) {
    out.event('operation', { operation: op });
    const how = op.paths?.length ? op.paths.map((p) => `${p.how === 'trash' ? 'trashed' : 'deleted'} ${tildify(p.path)}`).join(', ') : (op.commands ?? []).map((c) => `ran ${c}`).join(', ');
    out.line(`${op.at}  ${op.result.padEnd(7)} ${human(op.bytes).padStart(7)}  ${op.plugin}${op.item ? ` / ${op.item}` : ''}  ${tildify(op.label)}${how ? `  ${how}` : ''}${op.detail ? `  (${op.detail})` : ''}`);
  }
  if (!operations.length) out.line('No cleanups recorded yet.');
  return 0;
}

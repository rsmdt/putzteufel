import { tildify } from './paths.ts';
import { type Command } from './types.ts';

export function resolveCommand(run: string, minAge = 0): string {
  return run.replace(/\s*\{until\}/g, minAge > 0 ? ` --filter until=${minAge * 24}h` : '');
}

export function describeCommand(command: Command, minAge = 0): string {
  const run = resolveCommand(command.run, minAge);
  return command.cwd ? `(cd ${tildify(command.cwd)} && ${run})` : run;
}

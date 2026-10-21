import { rm } from 'node:fs/promises';
import { exists, isUnsafeToDelete, tildify } from './paths.ts';
import { describeCommand, execFileAsync, shell } from './shell.ts';
import type { Target } from './types.ts';

async function removePath(p: string): Promise<void> {
  try {
    await rm(p, { recursive: true, force: true });
  } catch {
    await execFileAsync('chmod', ['-R', 'u+w', p]).catch(() => undefined);
    await rm(p, { recursive: true, force: true });
  }
}

export async function cleanTarget(target: Target, useTrash: boolean): Promise<string[]> {
  const errors: string[] = [];
  if (target.commands.length) {
    for (const command of target.commands) {
      await shell(command.run, command.cwd).catch((e: Error & { stderr?: string }) => {
        errors.push(`${describeCommand(command)}: ${(e.stderr || e.message).trim().slice(-400)}`);
      });
    }
    return errors;
  }
  for (const p of target.paths) {
    if (!(await exists(p))) continue;
    if (isUnsafeToDelete(p)) {
      errors.push(`refused to delete ${p}`);
      continue;
    }
    try {
      if (useTrash) await execFileAsync('trash', [p]);
      else await removePath(p);
    } catch (e) {
      errors.push(`${tildify(p)}: ${(e as Error).message}`);
    }
  }
  return errors;
}

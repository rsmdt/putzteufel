import { rm } from 'node:fs/promises';
import path from 'node:path';
import { HOME, exists, isUnsafeToDelete, tildify } from './paths.ts';
import { describeCommand, execFileAsync, resolveCommand, shell, which } from './shell.ts';
import type { Target } from './types.ts';

export type Disposal = 'delete' | 'trash';

export interface CleanOptions {
  useTrash: boolean;
  trashAvailable: boolean;
  minAge?: number;
}

export interface Disposed {
  path: string;
  how: Disposal;
}

export interface CleanOutcome {
  errors: string[];
  disposed: Disposed[];
}

const TRASH_DIR = path.join(HOME, '.Trash');

export async function trashAvailable(): Promise<boolean> {
  return (await which('trash')) || (await which('osascript'));
}

export function disposalFor(target: Target, p: string, options: CleanOptions): Disposal {
  const insideTrash = p === TRASH_DIR || p.startsWith(TRASH_DIR + path.sep);
  return options.trashAvailable && !insideTrash && (options.useTrash || target.impact === 'dataloss') ? 'trash' : 'delete';
}

async function moveToTrash(p: string): Promise<void> {
  if (await which('trash')) await execFileAsync('trash', [p]);
  else await execFileAsync('osascript', ['-e', `tell application "Finder" to delete POSIX file ${JSON.stringify(p)}`]);
}

async function removePath(p: string): Promise<void> {
  try {
    await rm(p, { recursive: true, force: true });
  } catch {
    await execFileAsync('chmod', ['-R', 'u+w', p]).catch(() => undefined);
    await rm(p, { recursive: true, force: true });
  }
}

export async function cleanTarget(target: Target, options: CleanOptions): Promise<CleanOutcome> {
  const outcome: CleanOutcome = { errors: [], disposed: [] };
  if (target.commands.length) {
    for (const command of target.commands) {
      await shell(resolveCommand(command.run, options.minAge), command.cwd).catch((e: Error & { stderr?: string }) => {
        outcome.errors.push(`${describeCommand(command, options.minAge)}: ${(e.stderr || e.message).trim().slice(-400)}`);
      });
    }
    return outcome;
  }
  for (const p of target.paths) {
    if (!(await exists(p))) continue;
    if (isUnsafeToDelete(p)) {
      outcome.errors.push(`refused to delete ${p}`);
      continue;
    }
    const how = disposalFor(target, p, options);
    try {
      if (how === 'trash') await moveToTrash(p);
      else await removePath(p);
      outcome.disposed.push({ path: p, how });
    } catch (e) {
      outcome.errors.push(`${tildify(p)}: ${(e as Error).message}`);
    }
  }
  return outcome;
}

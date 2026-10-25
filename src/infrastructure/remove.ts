import { type CleanOptions, type Disposed, disposalFor } from '../domain/disposal.ts';
import { rm } from 'node:fs/promises';
import { isUnsafeToDelete, tildify } from '../domain/paths.ts';
import { exists } from './fs.ts';
import { describeCommand, resolveCommand } from '../domain/command.ts';
import { execFileAsync, shell, which } from './shell.ts';
import { dirEntries } from './measure.ts';
import { type Entry, type Target } from '../domain/types.ts';

const CLEAN_TIMEOUT = 30 * 60_000;
const SPLITS = 8;

interface CleanOutcome {
  errors: string[];
  disposed: Disposed[];
}

export async function trashAvailable(): Promise<boolean> {
  return (await which('trash')) || (await which('osascript'));
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

interface Pieces {
  parts: Entry[];
  folders: string[];
}

async function piecesOf(p: string): Promise<Pieces> {
  const parts = await dirEntries(p);
  const folders = [p];
  const total = parts.reduce((n, e) => n + e.size, 0);
  for (let i = 0; i < SPLITS; i++) {
    const big = parts.findIndex((e) => e.isDir && e.size > total / 4);
    if (big < 0) break;
    const [dir] = parts.splice(big, 1);
    folders.push(dir.path);
    parts.push(...(await dirEntries(dir.path)));
  }
  return { parts, folders: folders.reverse() };
}

async function deleteInPieces({ parts, folders }: Pieces, onFreed: (bytes: number) => void, signal?: AbortSignal): Promise<void> {
  for (const part of parts) {
    if (signal?.aborted) throw new Error('stopped partway; the rest is left in place');
    await removePath(part.path);
    onFreed(part.size);
  }
  for (const folder of folders) await removePath(folder);
}

export async function cleanTarget(target: Target, options: CleanOptions, signal?: AbortSignal, onProgress?: (fraction: number) => void): Promise<CleanOutcome> {
  const outcome: CleanOutcome = { errors: [], disposed: [] };
  if (target.commands.length) {
    for (const command of target.commands) {
      if (signal?.aborted) break;
      await shell(resolveCommand(command.run, options.minAge), command.cwd, CLEAN_TIMEOUT, signal).catch((e: Error & { stderr?: string }) => {
        outcome.errors.push(`${describeCommand(command, options.minAge)}: ${(e.stderr || e.message).trim().slice(-400)}`);
      });
    }
    return outcome;
  }
  const present: string[] = [];
  for (const p of target.paths) if (await exists(p)) present.push(p);
  const pieces = new Map<string, Pieces>();
  if (onProgress) for (const p of present) if (!isUnsafeToDelete(p) && disposalFor(target, p, options) === 'delete') pieces.set(p, await piecesOf(p));
  const total = [...pieces.values()].flatMap((x) => x.parts).reduce((n, e) => n + e.size, 0);
  let freed = 0;
  const report = (bytes: number) => {
    freed += bytes;
    if (total) onProgress?.(Math.min(1, freed / total));
  };
  for (const p of present) {
    if (signal?.aborted) break;
    if (isUnsafeToDelete(p)) {
      outcome.errors.push(`refused to delete ${p}`);
      continue;
    }
    const how = disposalFor(target, p, options);
    try {
      if (how === 'trash') await moveToTrash(p);
      else if (pieces.has(p)) await deleteInPieces(pieces.get(p)!, report, signal);
      else await removePath(p);
      outcome.disposed.push({ path: p, how });
    } catch (e) {
      outcome.errors.push(`${tildify(p)}: ${(e as Error).message}`);
    }
  }
  return outcome;
}

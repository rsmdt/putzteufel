import { exec, execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);

const execAsync = promisify(exec);

const whichCache = new Map<string, Promise<boolean>>();

export function which(bin: string): Promise<boolean> {
  if (!whichCache.has(bin)) {
    const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
    whichCache.set(
      bin,
      Promise.any(dirs.map((d) => access(path.join(d, bin), constants.X_OK))).then(
        () => true,
        () => false,
      ),
    );
  }
  return whichCache.get(bin)!;
}

export function forgetWhich(): void {
  whichCache.clear();
}

export async function shell(command: string, cwd?: string, timeout = 120_000): Promise<string> {
  const { stdout } = await execAsync(command, { cwd, timeout, maxBuffer: 64 * 1024 * 1024, shell: process.env.SHELL || '/bin/sh' });
  return stdout;
}

export function limiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active < concurrency && queue.length) {
      active++;
      queue.shift()!();
    }
  };
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() =>
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          }),
      );
      next();
    });
}

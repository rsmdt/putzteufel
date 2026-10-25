import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);

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

const OUTPUT_LIMIT = 64 * 1024 * 1024;
const PIPE_GRACE = 200;

export class CommandError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
    readonly code: number | null,
  ) {
    super(message);
  }
}

function killGroup(child: ChildProcess): void {
  try {
    process.kill(-child.pid!, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

export function shell(command: string, cwd?: string, timeout = 120_000, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CommandError(`stopped: ${command}`, '', null));
    const child = spawn(process.env.SHELL || '/bin/sh', ['-c', command], { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error?: CommandError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      child.stdout?.destroy();
      child.stderr?.destroy();
      if (error) reject(error);
      else resolve(stdout);
    };
    const timer = setTimeout(() => {
      killGroup(child);
      finish(new CommandError(`timed out after ${timeout / 1000}s: ${command}`, stderr, null));
    }, timeout);
    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < OUTPUT_LIMIT) stdout += chunk;
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < OUTPUT_LIMIT) stderr += chunk;
    });
    const stop = () => {
      killGroup(child);
      finish(new CommandError(`stopped: ${command}`, stderr, null));
    };
    signal?.addEventListener('abort', stop);
    child.on('error', (e) => finish(new CommandError(e.message, stderr, null)));
    child.on('exit', (code) => {
      const done = () => finish(code === 0 ? undefined : new CommandError(`Command failed: ${command}\n${stderr}`, stderr, code));
      child.stdout?.once('close', done);
      setTimeout(done, PIPE_GRACE);
    });
  });
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

import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { exists, tildify } from './paths.ts';
import { describeCommand, execFileAsync } from './shell.ts';
import type { Entry, Target } from './types.ts';

export async function diskUsage(paths: string[]): Promise<number> {
  const present = (await Promise.all(paths.map(async (p) => ((await exists(p)) ? p : null)))).filter((p): p is string => p !== null);
  if (!present.length) return 0;
  const stdout = await execFileAsync('du', ['-sk', '--', ...present], { maxBuffer: 16 * 1024 * 1024 }).then(
    (r) => r.stdout,
    (e: { stdout?: string }) => e.stdout ?? '',
  );
  return stdout
    .split('\n')
    .map((line) => Number.parseInt(line.split('\t')[0], 10))
    .filter(Number.isFinite)
    .reduce((sum, kb) => sum + kb * 1024, 0);
}

export async function newestMtime(paths: string[]): Promise<number | undefined> {
  const times = await Promise.all(
    paths.map(async (p) => {
      const stat = await lstat(p).catch(() => null);
      if (!stat) return 0;
      if (!stat.isDirectory()) return stat.mtimeMs;
      const names = await readdir(p).catch(() => [] as string[]);
      const children = await Promise.all(names.slice(0, 2000).map((n) => lstat(path.join(p, n)).then((s) => s.mtimeMs, () => 0)));
      return Math.max(stat.mtimeMs, ...children);
    }),
  );
  const newest = Math.max(0, ...times);
  return newest || undefined;
}

export async function entrySizes(paths: string[]): Promise<Entry[]> {
  const sizes = new Map<string, number>();
  for (let i = 0; i < paths.length; i += 256) {
    const chunk = paths.slice(i, i + 256);
    const stdout = await execFileAsync('du', ['-sk', '--', ...chunk], { maxBuffer: 16 * 1024 * 1024 }).then(
      (r) => r.stdout,
      (e: { stdout?: string }) => e.stdout ?? '',
    );
    for (const line of stdout.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab > 0) sizes.set(line.slice(tab + 1), Number.parseInt(line.slice(0, tab), 10) * 1024);
    }
  }
  const entries = await Promise.all(
    paths.map(async (p) => {
      const stat = await lstat(p).catch(() => null);
      return { name: path.basename(p), path: p, size: sizes.get(p) ?? 0, isDir: Boolean(stat?.isDirectory()), mtimeMs: stat?.mtimeMs };
    }),
  );
  return entries.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
}

export async function dirEntries(dir: string): Promise<Entry[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  return entrySizes(names.map((n) => path.join(dir, n)));
}

export async function listing(target: Target, limit: number): Promise<{ lines: string[]; truncated: boolean }> {
  const lines = [...target.commands.map((c) => `$ ${describeCommand(c)}`), ...target.listed];
  const walk = async (p: string): Promise<boolean> => {
    const stat = await lstat(p).catch(() => null);
    if (!stat) return false;
    if (!stat.isDirectory()) {
      lines.push(tildify(p));
      return lines.length >= limit;
    }
    const entries = await readdir(p).catch(() => [] as string[]);
    for (const name of entries.sort()) {
      if (await walk(path.join(p, name))) return true;
    }
    return false;
  };
  for (const p of target.paths) {
    if (await walk(p)) return { lines, truncated: true };
  }
  return { lines, truncated: false };
}

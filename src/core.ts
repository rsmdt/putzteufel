import { exec, execFile } from 'node:child_process';
import { access, constants, lstat, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

export const HOME = os.homedir();
export const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

export type Impact = 'regenerates' | 'rebuild' | 'redownload' | 'unknown' | 'dataloss';

export interface ImpactInfo {
  tag: string;
  color: string;
  meaning: string;
  preselected: boolean;
}

export const IMPACTS: Record<Impact, ImpactInfo> = {
  regenerates: { tag: 'regenerates', color: '#5fd787', meaning: 'The tool recreates it on its own when needed. Cheap to lose.', preselected: true },
  rebuild: { tag: 'rebuild', color: '#5fafd7', meaning: 'The next install or build recreates it. Costs time, nothing is lost.', preselected: true },
  redownload: { tag: 're-download', color: '#d7af5f', meaning: 'Fetched again from the network on next use. Costs bandwidth and time.', preselected: false },
  unknown: { tag: 'unknown', color: '#d787d7', meaning: 'putzteufel cannot tell whether anything recreates it. Review the files before selecting.', preselected: false },
  dataloss: { tag: 'data loss', color: '#ff5f5f', meaning: 'Cannot be recovered after removal.', preselected: false },
};

export const IMPACT_ORDER: Impact[] = ['regenerates', 'rebuild', 'redownload', 'unknown', 'dataloss'];

export interface Command {
  run: string;
  cwd?: string;
}

export interface Tool {
  bin: string;
  installed: boolean;
  broken?: string;
  install?: string;
  uninstall?: string;
  clean: Command[];
}

export interface Hooks {
  before?: string;
  after?: string;
}

export interface Target {
  id: number;
  plugin: string;
  category: string;
  label: string;
  paths: string[];
  sizePaths: string[];
  listed: string[];
  commands: Command[];
  impact: Impact;
  note?: string;
  tool?: Tool;
  hooks?: Hooks;
  size?: number;
  ageDays?: number;
  project?: string;
  selected: boolean;
}

export type TargetDraft = Partial<Omit<Target, 'id' | 'category' | 'selected'>> & { label: string };

export interface ScanContext {
  roots: string[];
  exclude: string[];
  olderThan: number;
  recentDays: number;
  signal: AbortSignal;
}

export type Emit = (draft: TargetDraft) => void;

export interface Plugin {
  name: string;
  category: string;
  description?: string;
  fallback?: boolean;
  tool?: { bin: string; install?: string };
  available(): Promise<boolean>;
  scan(ctx: ScanContext, emit: Emit): Promise<void>;
  measure(target: Target): Promise<void>;
}

export function expandHome(p: string): string {
  return p === '~' || p.startsWith('~/') ? path.join(HOME, p.slice(1)) : p;
}

export function tildify(p: string): string {
  return p === HOME || p.startsWith(HOME + path.sep) ? '~' + p.slice(HOME.length) : p;
}

export function wildcard(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((p) => wildcard(expandHome(p)).test(value));
}

export async function exists(p: string): Promise<boolean> {
  return lstat(p).then(
    () => true,
    () => false,
  );
}

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

export interface Entry {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
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
    paths.map(async (p) => ({ name: path.basename(p), path: p, size: sizes.get(p) ?? 0, isDir: await lstat(p).then((s) => s.isDirectory(), () => false) })),
  );
  return entries.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
}

export async function dirEntries(dir: string): Promise<Entry[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  return entrySizes(names.map((n) => path.join(dir, n)));
}

export function human(bytes: number | undefined): string {
  if (bytes === undefined) return '?';
  const units = ['B', 'K', 'M', 'G', 'T'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)}${units[unit]}`;
}

export function isRecent(target: Target, recentDays: number): boolean {
  return target.ageDays !== undefined && target.ageDays < recentDays;
}

export function isYounger(target: Target, recentDays: number, minAge: number): boolean {
  return (target.project !== undefined && isRecent(target, recentDays)) || isRecent(target, minAge);
}

export function preselect(target: Target, recentDays: number, minAge: number): boolean {
  return IMPACTS[target.impact].preselected && !isYounger(target, recentDays, minAge);
}

export function describeCommand(command: Command): string {
  return command.cwd ? `(cd ${tildify(command.cwd)} && ${command.run})` : command.run;
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

export function isUnsafeToDelete(p: string): boolean {
  const abs = path.resolve(p);
  return abs === HOME || HOME.startsWith(abs + path.sep) || abs.split(path.sep).filter(Boolean).length <= 1;
}

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

import { spawn } from 'node:child_process';
import { lstat, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { exists } from './fs.ts';
import { tildify } from '../domain/paths.ts';
import { describeCommand } from '../domain/command.ts';
import { execFileAsync } from './shell.ts';
import { type Entry, type Target } from '../domain/types.ts';

interface Measurement {
  size: number;
  linkedBytes: number;
  files: number;
  newest?: number;
  partial?: boolean;
}

export interface Freed {
  total: number;
  freed: number;
}

type Row = { key: string; bytes: number; links: number; mtime: number };

const STAT = process.platform === 'darwin' ? "stat -f '%d:%i %b %l %m'" : "stat -c '%d:%i %b %h %Y'";

const WALK_TIMEOUT = Number(process.env.PUTZTEUFEL_WALK_TIMEOUT_MS) || 10 * 60_000;

function walk(paths: string[], onRow: (row: Row) => void, timeout = WALK_TIMEOUT): Promise<boolean> {
  if (!paths.length) return Promise.resolve(true);
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', `find "$@" -type f -print0 2>/dev/null | xargs -0 ${STAT} 2>/dev/null`, 'sh', ...paths], { stdio: ['ignore', 'pipe', 'ignore'], detached: true });
    let complete = true;
    const timer = setTimeout(() => {
      complete = false;
      try {
        process.kill(-child.pid!, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }, timeout);
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      const [key, blocks, links, mtime] = line.split(' ');
      if (key && blocks) onRow({ key, bytes: Number(blocks) * 512, links: Number(links), mtime: Number(mtime) * 1000 });
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve(complete);
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve(complete);
    });
  });
}

const measured = new Map<string, Promise<Measurement>>();

export function forgetSizes(): void {
  measured.clear();
}

function measureOne(p: string): Promise<Measurement> {
  if (!measured.has(p)) {
    const result: Measurement = { size: 0, linkedBytes: 0, files: 0 };
    const linked = new Set<string>();
    measured.set(
      p,
      walk([p], (row) => {
        if (row.links > 1) {
          if (linked.has(row.key)) return;
          linked.add(row.key);
          result.linkedBytes += row.bytes;
        }
        result.size += row.bytes;
        result.files++;
        if (!result.newest || row.mtime > result.newest) result.newest = row.mtime;
      }).then((complete) => ({ ...result, partial: !complete || undefined })),
    );
  }
  return measured.get(p)!;
}

export async function measure(paths: string[]): Promise<Measurement> {
  const present = (await Promise.all([...new Set(paths)].map(async (p) => ((await exists(p)) ? p : null)))).filter((p): p is string => p !== null);
  const parts = await Promise.all(present.map(measureOne));
  return parts.reduce<Measurement>(
    (all, m) => ({ size: all.size + m.size, linkedBytes: all.linkedBytes + m.linkedBytes, files: all.files + m.files, newest: Math.max(all.newest ?? 0, m.newest ?? 0) || undefined, partial: all.partial || m.partial }),
    { size: 0, linkedBytes: 0, files: 0 },
  );
}

export async function exactFreed(paths: string[]): Promise<Freed> {
  const seen = new Map<string, { bytes: number; links: number; count: number }>();
  let single = 0;
  await walk([...new Set(paths)], (row) => {
    if (row.links <= 1) {
      single += row.bytes;
      return;
    }
    const entry = seen.get(row.key);
    if (entry) entry.count++;
    else seen.set(row.key, { bytes: row.bytes, links: row.links, count: 1 });
  });
  let total = single;
  let freed = single;
  for (const e of seen.values()) {
    total += e.bytes;
    if (e.count >= e.links) freed += e.bytes;
  }
  return { total, freed };
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

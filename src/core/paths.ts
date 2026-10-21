import { lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const HOME = os.homedir();

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

export function isUnsafeToDelete(p: string): boolean {
  const abs = path.resolve(p);
  return abs === HOME || HOME.startsWith(abs + path.sep) || abs.split(path.sep).filter(Boolean).length <= 1;
}

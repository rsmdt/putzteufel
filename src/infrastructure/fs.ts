import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

export async function exists(p: string): Promise<boolean> {
  return lstat(p).then(
    () => true,
    () => false,
  );
}

export async function identity(p: string): Promise<string | undefined> {
  return lstat(p).then(
    (s) => `${s.dev}:${s.ino}:${s.isSymbolicLink() ? 'link' : 'node'}`,
    () => undefined,
  );
}

export async function identities(paths: string[]): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const p of paths) {
    const id = await identity(p);
    if (id) found[p] = id;
  }
  return found;
}

export interface Folder {
  name: string;
  path: string;
  mtimeMs: number;
}

export async function subfolders(dir: string): Promise<Folder[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e) => {
        const full = path.join(dir, e.name);
        return { name: e.name, path: full, mtimeMs: await lstat(full).then((s) => s.mtimeMs, () => 0) };
      }),
  );
}

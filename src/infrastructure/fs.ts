import { lstat } from 'node:fs/promises';

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

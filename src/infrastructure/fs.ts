import { lstat } from 'node:fs/promises';

export async function exists(p: string): Promise<boolean> {
  return lstat(p).then(
    () => true,
    () => false,
  );
}

import os from 'node:os';
import { GROUPS } from '../domain/groups.ts';
import { type TargetDraft } from '../domain/types.ts';
import { subfolders } from '../infrastructure/fs.ts';
import { execFileAsync } from '../infrastructure/shell.ts';
import { definePlugin } from './api.ts';

const PROFILE_PREFIX = 'playwright_chromiumdev_profile-';
const PROFILE_MIN_AGE = 2 * 60 * 60_000;

async function userTempDir(): Promise<string> {
  if (process.platform !== 'darwin') return os.tmpdir();
  return (await execFileAsync('getconf', ['DARWIN_USER_TEMP_DIR']).then((r) => r.stdout.trim(), () => '')) || os.tmpdir();
}

function unused(folder: string): Promise<boolean> {
  return execFileAsync('pgrep', ['-f', folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')]).then(
    () => false,
    (e: { code?: number }) => e.code === 1,
  );
}

export async function leftoverProfiles(dir?: string, now = Date.now()): Promise<TargetDraft[]> {
  const stale = (await subfolders(dir ?? (await userTempDir()))).filter((f) => f.name.startsWith(PROFILE_PREFIX) && now - f.mtimeMs >= PROFILE_MIN_AGE);
  const drafts: TargetDraft[] = [];
  for (const f of stale) if (await unused(f.path)) drafts.push({ label: f.path, paths: [f.path] });
  return drafts;
}

export default definePlugin({
  name: 'Playwright',
  group: GROUPS.javascript,
  items: [
    { name: 'Browsers', tool: { bin: 'playwright' }, paths: ['~/Library/Caches/ms-playwright/*-*', '~/.cache/ms-playwright/*-*'], clean: 'playwright uninstall --all', impact: 'redownload', description: 'Reinstall with npx playwright install. Removed with playwright uninstall --all when the playwright CLI is on PATH.' },
    { name: 'Leftover browser profiles', scan: () => leftoverProfiles(), description: 'Temporary Chromium profiles of automation runs that ended over two hours ago and no process still uses.' },
  ],
});

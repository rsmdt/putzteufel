import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { GROUPS } from '../domain/groups.ts';
import { HOME } from '../domain/paths.ts';
import { type TargetDraft } from '../domain/types.ts';
import { identity, subfolders } from '../infrastructure/fs.ts';
import { execFileAsync } from '../infrastructure/shell.ts';
import { definePlugin } from './api.ts';

const SUPPORT = path.join(HOME, 'Library/Application Support/Claude');
const BUNDLES = ['claude-code', 'claude-code-vm'];

export const isVersionName = (name: string) => /^\d[^/]*$/.test(name) && !name.includes('..');

function claudeRunning(): Promise<boolean> {
  return execFileAsync('pgrep', ['-x', 'Claude']).then(
    () => true,
    (e: { code?: number }) => e.code !== 1,
  );
}

export async function oldBundledVersions(support = SUPPORT, running = claudeRunning): Promise<TargetDraft[]> {
  const active = (await readFile(path.join(support, 'claude-code-vm/.sdk-version'), 'utf8').catch(() => '')).trim();
  if (!isVersionName(active)) return [];
  const drafts: TargetDraft[] = [];
  for (const bundle of BUNDLES) {
    const versions = await subfolders(path.join(support, bundle));
    if (!versions.length) continue;
    if (!(await identity(path.join(support, bundle, active)))?.endsWith(':node')) return [];
    drafts.push(...versions.filter((v) => v.name !== active && isVersionName(v.name)).map((v) => ({ label: v.path, paths: [v.path] })));
  }
  if (drafts.length && (await running())) return [];
  return drafts;
}

export default definePlugin({
  name: 'Claude Desktop',
  group: GROUPS.ai,
  items: [{ name: 'Old Claude Code versions', scan: () => oldBundledVersions(), impact: 'redownload', description: 'Versions Claude Desktop no longer runs. The active one in .sdk-version is kept; nothing is offered while Claude is open.' }],
});

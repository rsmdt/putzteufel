import assert from 'node:assert/strict';
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { HOME } from '../src/domain/paths.ts';
import path from 'node:path';
import { test } from 'node:test';
import { type Plugin, type Target } from '../src/domain/types.ts';
import { builtinPlugins } from '../src/plugins/index.ts';
import { projectsScanner, singleItem } from '../src/infrastructure/plugins/build.ts';
import { cleanTarget } from '../src/infrastructure/remove.ts';
import { scanAll } from '../src/application/scan.ts';
import { tempDir, write } from './fixture.ts';

async function scan(plugins: Plugin[], roots: string[] = []): Promise<{ found: Target[]; errors: string[] }> {
  const found: Target[] = [];
  const errors: string[] = [];
  const ctx = { roots, exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(plugins, ctx, (t) => found.push(t), (m) => errors.push(m));
  return { found, errors };
}

const scanProjects = (root: string) => scan([projectsScanner(builtinPlugins)], [root]);

test('a tool whose list names the home folder, or a link to it, is skipped and nothing is offered', async () => {
  const root = tempDir();
  symlinkSync(HOME, path.join(root, 'home-link'));
  for (const target of [HOME, path.join(root, 'home-link')]) {
    const { found, errors } = await scan([singleItem({ name: 'Greedy', list: `echo ${target}`, clean: 'true' })]);
    assert.deepEqual(found, []);
    assert.match(errors.join('\n'), /never cleans; skipped/);
  }
});

test('a folder replaced between the scan and the clean is left in place', async () => {
  const root = tempDir();
  write(root, { 'p/package.json': '{}', 'p/node_modules/a': 'x' });
  const { found } = await scanProjects(root);
  const modules = path.join(root, 'p/node_modules');
  rmSync(modules, { recursive: true });
  write(root, { 'p/node_modules/swapped': 'y' });
  const { errors } = await cleanTarget(found[0], { useTrash: false, trashAvailable: false });
  assert.match(errors.join(), /was replaced since the scan, left in place/);
  assert.ok(existsSync(path.join(modules, 'swapped')));
});

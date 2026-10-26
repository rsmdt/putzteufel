import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, rmSync, symlinkSync, utimesSync } from 'node:fs';
import { HOME } from '../src/domain/paths.ts';
import path from 'node:path';
import { test } from 'node:test';
import { type Plugin, type Target } from '../src/domain/types.ts';
import { builtinPlugins } from '../src/plugins/index.ts';
import { projectsScanner, singleItem } from '../src/infrastructure/plugins/build.ts';
import { cleanTarget } from '../src/infrastructure/remove.ts';
import { scanAll } from '../src/application/scan.ts';
import { installed, tempDir, write } from './fixture.ts';

const SIGNATURE = 'Signature: 8a477f597d28d172789f06886806bc55\n# This file is a cache directory tag.\n';

async function scan(plugins: Plugin[], roots: string[] = []): Promise<{ found: Target[]; errors: string[] }> {
  const found: Target[] = [];
  const errors: string[] = [];
  const ctx = { roots, exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(plugins, ctx, (t) => found.push(t), (m) => errors.push(m));
  return { found, errors };
}

const scanProjects = (root: string) => scan([projectsScanner(builtinPlugins)], [root]);

test('a folder with a valid CACHEDIR.TAG is offered once, under the plugin that knows it best', async () => {
  const root = tempDir();
  write(root, {
    'tool/.thing-cache/CACHEDIR.TAG': SIGNATURE,
    'tool/.thing-cache/blob': 'x',
    'tool/fake/CACHEDIR.TAG': 'not a tag',
    'rust/Cargo.toml': '',
    'rust/target/CACHEDIR.TAG': SIGNATURE,
  });
  const { found } = await scanProjects(root);
  assert.deepEqual(found.map((t) => `${t.plugin}/${t.item} ${path.relative(root, t.paths[0])}`).sort(), ['CACHEDIR.TAG/Tagged cache tool/.thing-cache', 'Cargo/target rust/target']);
});

test('a tool whose list names the home folder, or a link to it, is skipped and nothing is offered', async () => {
  const root = tempDir();
  symlinkSync(HOME, path.join(root, 'home-link'));
  for (const target of [HOME, path.join(root, 'home-link')]) {
    const { found, errors } = await scan([singleItem({ name: 'Greedy', list: `echo ${target}`, clean: 'true' })]);
    assert.deepEqual(found, []);
    assert.match(errors.join('\n'), /never cleans; skipped/);
  }
});

test('node_modules is only preselected when the lockfile and install record match and nothing changed since', async () => {
  const root = tempDir();
  write(root, {
    'clean/package.json': '{}',
    'clean/node_modules/a/index.js': 'x',
    'edited/package.json': '{}',
    'edited/node_modules/a/index.js': 'x',
    'bare/package.json': '{}',
    'bare/node_modules/a/index.js': 'x',
  });
  installed(root, 'clean', 'edited');
  const later = new Date(Date.now() + 120_000);
  utimesSync(path.join(root, 'edited/node_modules/a/index.js'), later, later);
  const { found } = await scanProjects(root);
  const of = (name: string) => found.find((t) => t.label === path.join(root, name))!;
  assert.equal(of('clean').impact, 'rebuild');
  assert.equal(of('edited').impact, 'unknown');
  assert.match(of('edited').note!, /index\.js changed after the last install/);
  assert.equal(of('bare').impact, 'unknown');
  assert.match(of('bare').note!, /no lockfile and install record/);
});

test('a project with a process running inside it is not preselected', async () => {
  const root = tempDir();
  write(root, { 'busy/package.json': '{}', 'busy/node_modules/a': 'x' });
  installed(root, 'busy');
  const child = spawn('sleep', ['30'], { cwd: path.join(root, 'busy') });
  try {
    await new Promise((r) => setTimeout(r, 200));
    const { found } = await scanProjects(root);
    assert.equal(found[0].impact, 'unknown');
    assert.match(found[0].note!, /A process is running in/);
    assert.equal(found[0].selected, false);
  } finally {
    child.kill();
  }
});

test('a folder replaced between the scan and the clean is left in place', async () => {
  const root = tempDir();
  write(root, { 'p/package.json': '{}', 'p/node_modules/a': 'x' });
  installed(root, 'p');
  const { found } = await scanProjects(root);
  const modules = path.join(root, 'p/node_modules');
  rmSync(modules, { recursive: true });
  write(root, { 'p/node_modules/swapped': 'y' });
  const { errors } = await cleanTarget(found[0], { useTrash: false, trashAvailable: false });
  assert.match(errors.join(), /was replaced since the scan, left in place/);
  assert.ok(existsSync(path.join(modules, 'swapped')));
});

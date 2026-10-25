import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { loadConfig } from '../src/infrastructure/config/load.ts';
import { type Target } from '../src/domain/types.ts';
import { pluginsFrom, singleItem } from '../src/infrastructure/plugins/build.ts';
import { overlapIndex, uniqueSize } from '../src/domain/overlap.ts';
import { scanAll } from '../src/application/scan.ts';
import { tempDir, write } from './fixture.ts';

async function setup() {
  const root = tempDir();
  write(root, {
    'cache/one/a': 'x',
    'cache/two/b': 'x',
    'cache/.hidden/c': 'x',
    'thing/file': 'x',
    'config.mjs': `export default {
  settings: { recentDays: 3, exclude: ['*/two'] },
  projects: [{ name: 'Custom build', markers: ['custom.txt'], dirs: ['artifacts'] }],
  plugins: [
    { name: 'Glob cache', group: 'Mine', paths: ['${root}/cache/*'] },
    { name: 'Tool cache', list: 'echo ${root}/thing; echo some-image 12MB', clean: 'echo cleaned' },
    { name: 'Code plugin', scan: async () => [{ label: 'generated', listed: ['line from code'] }] },
    { name: 'Clean only', clean: 'rm -rf /' },
    { name: 'Missing tool', requires: ['definitely-not-installed-xyz'], paths: ['${root}/cache'] },
    { name: 'Typo', path: ['${root}/cache'] },
  ],
};`,
  });
  const config = await loadConfig([path.join(root, 'config.mjs')], { builtin: false });
  return { root, config };
}

test('invalid plugins are reported with their name and file', async () => {
  const { root, config } = await setup();
  const file = path.join(root, 'config.mjs');
  assert.equal(config.errors.length, 2);
  assert.match(config.errors[0], new RegExp(`${file}: plugin "Clean only" has "clean" but nothing that lists affected files`));
  assert.match(config.errors[1], /plugin "Typo" has unknown key\(s\): path/);
  assert.deepEqual(config.plugins.map((p) => p.name), ['Custom build', 'Glob cache', 'Tool cache', 'Code plugin', 'Missing tool']);
  assert.deepEqual(config.plugins.find((p) => p.name === 'Custom build')?.projects?.map((r) => r.name), ['Custom build']);
  assert.equal(config.settings.recentDays, 3);
});

test('config plugins list their affected items', async () => {
  const { root, config } = await setup();
  const found: Target[] = [];
  const ctx = { roots: [root], exclude: config.settings.exclude, olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(pluginsFrom(config.plugins), ctx, (t) => found.push(t), assert.fail);
  const glob = found.filter((t) => t.plugin === 'Glob cache').map((t) => path.basename(t.label)).sort();
  assert.deepEqual(glob, ['.hidden', 'one']);
  const tool = found.find((t) => t.plugin === 'Tool cache')!;
  assert.deepEqual(tool.paths, [path.join(root, 'thing')]);
  assert.deepEqual(tool.listed, ['some-image 12MB']);
  assert.deepEqual(tool.commands, [{ run: 'echo cleaned' }]);
  assert.ok(tool.size! > 0);
  assert.deepEqual(found.find((t) => t.plugin === 'Code plugin')!.listed, ['line from code']);
  assert.equal(found.some((t) => t.plugin === 'Missing tool'), false);
});

test('user plugins override built-ins by name and settings can disable them', async () => {
  const root = tempDir();
  write(root, { 'c.mjs': `export default { settings: { disable: ['pip', 'Node'] }, plugins: [{ name: 'uv', list: 'echo /tmp', clean: 'true' }] };` });
  const config = await loadConfig([path.join(root, 'c.mjs')]);
  assert.deepEqual(config.errors, []);
  assert.equal(config.plugins.find((p) => p.name === 'uv')!.items![0].list, 'echo /tmp');
  assert.equal(config.plugins.some((p) => p.name === 'pip'), false);
  assert.equal(config.plugins.some((p) => p.name === 'Node'), false);
});

test('a catch-all plugin still lists folders a specific plugin owns, and they are counted once', async () => {
  const root = tempDir();
  write(root, { 'cache/tool/a': 'x'.repeat(9000), 'cache/other/b': 'x', 'cache/models/hub/m1/c': 'x' });
  const specs = [
    { name: 'Generic', paths: [`${root}/cache/*`], fallback: true },
    { name: 'Tool', list: `echo ${root}/cache/tool`, clean: 'true' },
    { name: 'Models', paths: [`${root}/cache/models/hub/*`] },
  ];
  const found: Target[] = [];
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(specs.map((s) => singleItem(s)), ctx, (t) => found.push(t), assert.fail);
  const generic = found.filter((t) => t.plugin === 'Generic').map((t) => path.basename(t.label)).sort();
  assert.deepEqual(generic, ['models', 'other', 'tool']);
  const index = overlapIndex(found);
  const tool = found.find((t) => t.plugin === 'Tool')!;
  const genericTool = found.find((t) => t.plugin === 'Generic' && t.label.endsWith('tool'))!;
  assert.equal(index.coveredBy(genericTool)?.plugin, 'Tool');
  assert.equal(index.coveredBy(tool), undefined);
  assert.deepEqual(index.sharedWith(tool).map((t) => t.plugin), ['Generic']);
  assert.deepEqual(index.owners(`${root}/cache/models/hub/m1/c`).map((t) => t.plugin).sort(), ['Generic', 'Models']);
  const sum = found.reduce((n, t) => n + (t.size ?? 0), 0);
  assert.ok(uniqueSize(found) < sum);
  assert.equal(uniqueSize(found), sum - genericTool.size! - found.find((t) => t.plugin === 'Models')!.size!);
});

test('the old safety key and unknown impacts are rejected with the allowed values', async () => {
  const root = tempDir();
  write(root, { 'c.mjs': `export default { plugins: [{ name: 'Old', paths: ['/tmp/x'], safety: 'costly' }, { name: 'Bad', paths: ['/tmp/x'], impact: 'scary' }, { name: 'Good', paths: ['/tmp/x'], impact: 'redownload', description: 'why' }] };` });
  const config = await loadConfig([path.join(root, 'c.mjs')], { builtin: false });
  assert.match(config.errors[0], /plugin "Old": "safety" was replaced by "impact", one of "regenerates", "rebuild", "redownload", "unknown", "dataloss"/);
  assert.match(config.errors[1], /plugin "Bad": "impact" must be one of/);
  assert.deepEqual(config.plugins.map((p) => p.name), ['Good']);
});

test('hooks and tool keys are validated', async () => {
  const root = tempDir();
  write(root, {
    'c.mjs': `export default {
  settings: { hooks: { before: 'echo start', after: 'echo end' } },
  projects: [{ name: 'Hooked', dirs: ['out'], hooks: { after: 'echo done' } }],
  plugins: [
    { name: 'Good', paths: ['/tmp/x'], tool: { bin: 'thing', install: 'brew install thing' }, hooks: { before: 'echo hi' } },
    { name: 'No bin', paths: ['/tmp/x'], tool: { install: 'brew install thing' } },
    { name: 'Bad hook', paths: ['/tmp/x'], hooks: { during: 'echo' } },
  ],
};`,
  });
  const config = await loadConfig([path.join(root, 'c.mjs')], { builtin: false });
  assert.deepEqual(config.settings.hooks, { before: 'echo start', after: 'echo end' });
  assert.deepEqual(config.plugins.find((p) => p.name === 'Hooked')?.projects?.map((r) => r.hooks), [{ after: 'echo done' }]);
  assert.deepEqual(config.plugins.map((p) => p.name), ['Hooked', 'Good']);
  assert.match(config.errors[0], /plugin "No bin": "tool" needs "bin"/);
  assert.match(config.errors[1], /plugin "Bad hook": "hooks" has unknown key "during"; allowed: before, after/);
});

test('plugin definitions, the old category key, and disabling one part of a plugin', async () => {
  const root = tempDir();
  write(root, {
    'c.mjs': `export default {
  settings: { disable: ['Docker/Unused volumes', 'Trash'] },
  plugins: [
    { name: 'Mine', group: 'Python', items: [{ name: 'A', paths: ['/tmp/a'] }], projects: [{ name: 'B', dirs: ['out'] }] },
    { name: 'Old', category: 'Apps', paths: ['/tmp/x'] },
    { name: 'Empty', items: [] },
  ],
};`,
  });
  const config = await loadConfig([path.join(root, 'c.mjs')]);
  assert.match(config.errors[0], /plugin "Old": "category" was replaced by "group"/);
  assert.match(config.errors[1], /plugin "Empty" needs at least one entry in "items" or "projects"/);
  const mine = config.plugins.find((p) => p.name === 'Mine')!;
  assert.equal(mine.group, 'Python');
  assert.deepEqual([mine.items?.map((i) => i.name), mine.projects?.map((r) => r.name)], [['A'], ['B']]);
  assert.equal(config.plugins.some((p) => p.name === 'Trash'), false);
  const docker = config.plugins.find((p) => p.name === 'Docker')!;
  assert.equal(docker.items?.some((i) => i.name === 'Unused volumes'), false);
  assert.equal(docker.items?.length, 5);
});

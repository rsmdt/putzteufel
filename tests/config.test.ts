import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { loadConfig } from '../src/config.ts';
import type { Target } from '../src/core.ts';
import { SpecPlugin } from '../src/plugins.ts';
import { scanAll } from '../src/scan.ts';
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
    { name: 'Glob cache', category: 'Mine', paths: ['${root}/cache/*'] },
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
  assert.deepEqual(config.plugins.map((p) => p.name), ['Glob cache', 'Tool cache', 'Code plugin', 'Missing tool']);
  assert.deepEqual(config.rules.map((r) => r.name), ['Custom build']);
  assert.equal(config.settings.recentDays, 3);
});

test('config plugins list their affected items', async () => {
  const { root, config } = await setup();
  const found: Target[] = [];
  const ctx = { roots: [root], exclude: config.settings.exclude, olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(config.plugins.map((s) => new SpecPlugin(s)), ctx, (t) => found.push(t), assert.fail);
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
  assert.equal(config.plugins.find((p) => p.name === 'uv')!.list, 'echo /tmp');
  assert.equal(config.plugins.some((p) => p.name === 'pip'), false);
  assert.equal(config.rules.some((r) => r.name === 'Node'), false);
});

test('fallback plugins skip paths a specific plugin already claimed', async () => {
  const root = tempDir();
  write(root, { 'cache/tool/a': 'x', 'cache/other/b': 'x', 'cache/models/hub/m1/c': 'x' });
  const specs = [
    { name: 'Generic', paths: [`${root}/cache/*`], fallback: true },
    { name: 'Tool', list: `echo ${root}/cache/tool`, clean: 'true' },
    { name: 'Models', paths: [`${root}/cache/models/hub/*`] },
  ];
  const found: Target[] = [];
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(specs.map((s) => new SpecPlugin(s)), ctx, (t) => found.push(t), assert.fail);
  const generic = found.filter((t) => t.plugin === 'Generic').map((t) => path.basename(t.label));
  assert.deepEqual(generic, ['other']);
  assert.equal(found.length, 3);
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
  assert.deepEqual(config.rules.map((r) => r.hooks), [{ after: 'echo done' }]);
  assert.deepEqual(config.plugins.map((p) => p.name), ['Good']);
  assert.match(config.errors[0], /plugin "No bin": "tool" needs "bin"/);
  assert.match(config.errors[1], /plugin "Bad hook": "hooks" has unknown key "during"; allowed: before, after/);
});

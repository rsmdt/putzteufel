import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { builtinPlugins } from '../src/plugins/index.ts';
import type { Target } from '../src/core/index.ts';
import { projectsScanner } from '../src/engine/build.ts';
import { scanAll } from '../src/engine/scan.ts';
import { projectTree } from './fixture.ts';

async function scanProjects(root: string, recentDays = 7): Promise<Target[]> {
  const found: Target[] = [];
  const errors: string[] = [];
  const ctx = { roots: [root], exclude: [], olderThan: 0, recentDays, signal: new AbortController().signal };
  await scanAll([projectsScanner(builtinPlugins)], ctx, (t) => found.push(t), (m) => errors.push(m));
  assert.deepEqual(errors, []);
  return found;
}

test('project scan finds exactly the regenerable folders', async () => {
  const root = projectTree();
  const found = await scanProjects(root);
  const summary = found.map((t) => `${t.plugin}/${t.item} ${path.relative(root, t.label)} ${t.paths.map((p) => path.relative(t.label, p)).sort().join(',')}`).sort();
  assert.deepEqual(summary, [
    'Cargo/target rust target',
    'Node/Build output tracked dist',
    'Node/Build output web dist',
    'Node/Dependencies old node_modules',
    'Node/Dependencies web .next,node_modules',
    'Python/Caches py/src __pycache__',
    'Python/Virtual environment py .venv',
    'React Native/Native builds rn android/build',
    'Unity/Library and temp unity Library',
    'Unreal/Intermediate files unreal Intermediate',
  ]);
  assert.ok(existsSync(path.join(root, 'outside/precious')));
});

test('recent projects and unknown-impact rules start unselected, stale rebuild ones selected', async () => {
  const root = projectTree();
  const found = await scanProjects(root);
  const byLabel = (rel: string, plugin: string, item?: string) => found.find((t) => t.label === path.join(root, rel) && t.plugin === plugin && (!item || t.item === item))!;
  assert.equal(byLabel('old', 'Node', 'Dependencies').selected, true);
  assert.ok(byLabel('old', 'Node').ageDays! > 1000);
  assert.equal(byLabel('web', 'Node').selected, false);
  assert.equal(byLabel('web', 'Node', 'Build output').impact, 'unknown');
  assert.equal(byLabel('old', 'Node', 'Dependencies').impact, 'rebuild');
  assert.equal(byLabel('old', 'Node', 'Dependencies').group, 'JavaScript');
  assert.match(byLabel('old', 'Node').note ?? '', /install/);
  assert.ok(byLabel('web', 'Node').size! > 0);
});

test('olderThan leaves recently edited projects unselected', async () => {
  const root = projectTree();
  const found: Target[] = [];
  const ctx = { roots: [root], exclude: [], olderThan: 30, recentDays: 7, signal: new AbortController().signal };
  await scanAll([projectsScanner(builtinPlugins)], ctx, (t) => found.push(t), () => undefined);
  assert.deepEqual(found.filter((t) => t.selected).map((t) => path.relative(root, t.label)), ['old']);
  assert.ok(found.length > 1);
});

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { builtinRules } from '../src/builtin.ts';
import type { Target } from '../src/core.ts';
import { ProjectsPlugin } from '../src/projects.ts';
import { scanAll } from '../src/scan.ts';
import { projectTree } from './fixture.ts';

async function scanProjects(root: string, recentDays = 7): Promise<Target[]> {
  const found: Target[] = [];
  const errors: string[] = [];
  const ctx = { roots: [root], exclude: [], olderThan: 0, recentDays, signal: new AbortController().signal };
  await scanAll([new ProjectsPlugin(builtinRules)], ctx, (t) => found.push(t), (m) => errors.push(m));
  assert.deepEqual(errors, []);
  return found;
}

test('project scan finds exactly the regenerable folders', async () => {
  const root = projectTree();
  const found = await scanProjects(root);
  const summary = found.map((t) => `${t.plugin} ${path.relative(root, t.label)} ${t.paths.map((p) => path.relative(t.label, p)).sort().join(',')}`).sort();
  assert.deepEqual(summary, [
    'Cargo rust target',
    'Node build output tracked dist',
    'Node build output web dist',
    'Node old node_modules',
    'Node web .next,node_modules',
    'Python caches py/src __pycache__',
    'Python venv py .venv',
    'React Native rn android/build',
    'Unity unity Library',
    'Unreal unreal Intermediate',
  ]);
  assert.ok(existsSync(path.join(root, 'outside/precious')));
});

test('recent projects and costly rules start unselected, stale safe ones selected', async () => {
  const root = projectTree();
  const found = await scanProjects(root);
  const byLabel = (rel: string, plugin: string) => found.find((t) => t.label === path.join(root, rel) && t.plugin === plugin)!;
  assert.equal(byLabel('old', 'Node').selected, true);
  assert.ok(byLabel('old', 'Node').ageDays! > 1000);
  assert.equal(byLabel('web', 'Node').selected, false);
  assert.equal(byLabel('web', 'Node build output').safety, 'costly');
  assert.ok(byLabel('web', 'Node').size! > 0);
});

test('olderThan drops recently edited projects', async () => {
  const root = projectTree();
  const found: Target[] = [];
  const ctx = { roots: [root], exclude: [], olderThan: 30, recentDays: 7, signal: new AbortController().signal };
  await scanAll([new ProjectsPlugin(builtinRules)], ctx, (t) => found.push(t), () => undefined);
  assert.deepEqual(found.map((t) => path.relative(root, t.label)), ['old']);
});

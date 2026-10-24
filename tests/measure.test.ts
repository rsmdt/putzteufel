import assert from 'node:assert/strict';
import { linkSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { test } from 'bun:test';
import { type Target, exactFreed, forgetSizes, measure } from '../src/core/index.ts';
import { singleItem } from '../src/engine/build.ts';
import { scanAll } from '../src/engine/scan.ts';
import { tempDir, write } from './fixture.ts';

function linkedTree() {
  const root = tempDir();
  write(root, { 'store/blob': 'x'.repeat(64_000), 'store/only': 'y'.repeat(32_000), 'project/node_modules/own': 'z'.repeat(16_000) });
  linkSync(path.join(root, 'store/blob'), path.join(root, 'project/node_modules/blob'));
  linkSync(path.join(root, 'store/blob'), path.join(root, 'store/blob-again'));
  return root;
}

test('hard links are counted once per folder and reported as linked bytes', async () => {
  const root = linkedTree();
  forgetSizes();
  const store = await measure([path.join(root, 'store')]);
  const modules = await measure([path.join(root, 'project/node_modules')]);
  assert.equal(store.files, 2);
  assert.ok(store.size >= 96_000 && store.size < 120_000, `${store.size}`);
  assert.ok(store.linkedBytes >= 64_000 && store.linkedBytes < 80_000);
  assert.ok(modules.linkedBytes >= 64_000);
});

test('exact freed space counts each file once and only frees files whose every link is selected', async () => {
  const root = linkedTree();
  const both = await exactFreed([path.join(root, 'store'), path.join(root, 'project/node_modules')]);
  const modulesOnly = await exactFreed([path.join(root, 'project/node_modules')]);
  assert.ok(both.total >= 112_000 && both.total < 140_000, `${both.total}`);
  assert.equal(both.freed, both.total);
  assert.ok(modulesOnly.total >= 80_000);
  assert.ok(modulesOnly.freed >= 16_000 && modulesOnly.freed < 30_000, `${modulesOnly.freed}`);
});

test('a cache is as young as its newest file at any depth', async () => {
  const root = tempDir();
  write(root, { 'cache/a/b/c/new': 'x', 'cache/old': 'y' });
  const old = new Date(Date.now() - 400 * 86_400_000);
  for (const p of ['cache', 'cache/a', 'cache/a/b', 'cache/a/b/c', 'cache/old']) utimesSync(path.join(root, p), old, old);
  utimesSync(path.join(root, 'cache/a/b/c/new'), new Date(Date.now() - 2 * 86_400_000), new Date(Date.now() - 2 * 86_400_000));
  forgetSizes();
  const found: Target[] = [];
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll([singleItem({ name: 'Deep', paths: [path.join(root, 'cache')] })], ctx, (t) => found.push(t), assert.fail);
  assert.ok(found[0].ageDays! > 1.9 && found[0].ageDays! < 2.5, `${found[0].ageDays}`);
});

test('items appear right away with last run’s estimate, then get measured', async () => {
  const root = tempDir();
  write(root, { 'cache/x': 'x'.repeat(10_000) });
  const item = singleItem({ name: 'Estimated', paths: [path.join(root, 'cache')] });
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  const first: Target[] = [];
  await scanAll([item], ctx, (t) => first.push(t), assert.fail);
  const estimates = new Map([[first[0].key, { size: 999, ageDays: 3, at: Date.now() }]]);
  const seen: { size?: number; estimated?: boolean }[] = [];
  const measured: Target[] = [];
  await scanAll([item], ctx, (t) => measured.push(t), assert.fail, { estimates, onFound: (t) => seen.push({ size: t.size, estimated: t.estimated }) });
  assert.deepEqual(seen, [{ size: 999, estimated: true }]);
  assert.equal(measured[0].key, first[0].key);
  assert.equal(measured[0].estimated, undefined);
  assert.ok(measured[0].size! >= 10_000);
});

import assert from 'node:assert/strict';
import { test } from 'bun:test';
import type { Target } from '../src/core/index.ts';
import { coveredIn, overlapIndex, uniqueSize } from '../src/engine/overlap.ts';

let id = 0;
const t = (plugin: string, paths: string[], size: number, fallback = false): Target => ({ id: ++id, key: String(id), plugin, group: 'G', label: paths[0] ?? plugin, paths, sizePaths: [], listed: paths.length ? [] : ['x'], commands: [], impact: 'regenerates', selected: true, size, fallback: fallback || undefined });

test('nested folders are counted under the outer one', () => {
  const outer = t('Node', ['/p/node_modules'], 100);
  const inner = t('Other', ['/p/node_modules/.cache'], 30);
  assert.equal(overlapIndex([outer, inner]).coveredBy(inner)?.id, outer.id);
  assert.equal(uniqueSize([outer, inner]), 100);
  assert.equal(uniqueSize([inner]), 30);
});

test('equal folders count once, under the specific plugin rather than the catch-all', () => {
  const generic = t('XDG caches', ['/h/.cache/uv'], 50, true);
  const uv = t('uv', ['/h/.cache/uv'], 50);
  const covered = coveredIn([generic, uv]);
  assert.equal(covered.get(generic.id)?.plugin, 'uv');
  assert.equal(covered.has(uv.id), false);
  assert.equal(uniqueSize([generic, uv]), 50);
});

test('a target is only covered when every one of its folders is', () => {
  const a = t('A', ['/x/one', '/x/two'], 20);
  const b = t('B', ['/x/one'], 10);
  assert.equal(overlapIndex([a, b]).coveredBy(a), undefined);
  assert.equal(overlapIndex([a, b]).coveredBy(b)?.id, a.id);
  assert.equal(uniqueSize([a, b]), 20);
});

test('items without folders are never covered and siblings do not overlap', () => {
  const docker = t('Docker', [], 70);
  const left = t('A', ['/x/ab'], 5);
  const right = t('B', ['/x/a'], 5);
  const index = overlapIndex([docker, left, right]);
  assert.equal(index.coveredBy(docker), undefined);
  assert.deepEqual(index.sharedWith(left), []);
  assert.equal(uniqueSize([docker, left, right]), 80);
});

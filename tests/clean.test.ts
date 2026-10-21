import assert from 'node:assert/strict';
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { HOME, type Target, cleanTarget } from '../src/core/index.ts';
import { tempDir, write } from './fixture.ts';

const target = (fields: Partial<Target>): Target => ({
  id: 1,
  plugin: 'test',
  category: 'test',
  label: 'test',
  paths: [],
  sizePaths: [],
  listed: [],
  commands: [],
  impact: 'regenerates',
  selected: true,
  ...fields,
});

test('deletes paths, including read-only trees', async () => {
  const root = tempDir();
  write(root, { 'ro/sub/file': 'x', 'plain/file': 'x' });
  chmodSync(path.join(root, 'ro/sub'), 0o555);
  const errors = await cleanTarget(target({ paths: [path.join(root, 'ro'), path.join(root, 'plain')] }), false);
  assert.deepEqual(errors, []);
  assert.equal(existsSync(path.join(root, 'ro')), false);
  assert.equal(existsSync(path.join(root, 'plain')), false);
});

test('refuses the home directory and filesystem roots', async () => {
  const errors = await cleanTarget(target({ paths: [HOME, '/usr'] }), false);
  assert.equal(errors.length, 2);
  assert.ok(existsSync(HOME));
});

test('runs the tool command instead of deleting when one is given', async () => {
  const root = tempDir();
  write(root, { 'keep/file': 'x' });
  const errors = await cleanTarget(target({ paths: [path.join(root, 'keep')], commands: [{ run: 'touch ran', cwd: root }] }), false);
  assert.deepEqual(errors, []);
  assert.ok(existsSync(path.join(root, 'ran')));
  assert.ok(existsSync(path.join(root, 'keep/file')));
});

test('reports failing commands', async () => {
  const errors = await cleanTarget(target({ commands: [{ run: 'echo nope >&2; exit 3' }] }), false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /nope/);
});

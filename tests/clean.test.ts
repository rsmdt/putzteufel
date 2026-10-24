import assert from 'node:assert/strict';
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'bun:test';
import { HOME } from '../src/domain/paths.ts';
import { type Target } from '../src/domain/types.ts';
import { cleanTarget } from '../src/infrastructure/remove.ts';
import { disposalFor } from '../src/domain/disposal.ts';

const OPTIONS = { useTrash: false, trashAvailable: false };
import { tempDir, write } from './fixture.ts';

const target = (fields: Partial<Target>): Target => ({
  id: 1,
  key: 'k',
  plugin: 'test',
  group: 'test',
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
  const { errors } = await cleanTarget(target({ paths: [path.join(root, 'ro'), path.join(root, 'plain')] }), OPTIONS);
  assert.deepEqual(errors, []);
  assert.equal(existsSync(path.join(root, 'ro')), false);
  assert.equal(existsSync(path.join(root, 'plain')), false);
});

test('refuses the home directory and filesystem roots', async () => {
  const { errors } = await cleanTarget(target({ paths: [HOME, '/usr'] }), OPTIONS);
  assert.equal(errors.length, 2);
  assert.ok(existsSync(HOME));
});

test('runs the tool command instead of deleting when one is given', async () => {
  const root = tempDir();
  write(root, { 'keep/file': 'x' });
  const { errors } = await cleanTarget(target({ paths: [path.join(root, 'keep')], commands: [{ run: 'touch ran', cwd: root }] }), OPTIONS);
  assert.deepEqual(errors, []);
  assert.ok(existsSync(path.join(root, 'ran')));
  assert.ok(existsSync(path.join(root, 'keep/file')));
});

test('reports failing commands', async () => {
  const { errors } = await cleanTarget(target({ commands: [{ run: 'echo nope >&2; exit 3' }] }), OPTIONS);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /nope/);
});

test('data-loss folders go to the Trash even in delete mode, but never things already in the Trash', () => {
  const t = target({ impact: 'dataloss' });
  const on = { useTrash: false, trashAvailable: true };
  assert.equal(disposalFor(t, '/x/archive', on), 'trash');
  assert.equal(disposalFor(t, path.join(HOME, '.Trash/old'), on), 'delete');
  assert.equal(disposalFor(target({ impact: 'rebuild' }), '/x/node_modules', on), 'delete');
  assert.equal(disposalFor(target({ impact: 'rebuild' }), '/x/node_modules', { ...on, useTrash: true }), 'trash');
  assert.equal(disposalFor(t, '/x/archive', { useTrash: true, trashAvailable: false }), 'delete');
});

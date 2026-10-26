import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { type Target } from '../src/domain/types.ts';
import { tempDir, write } from './fixture.ts';

process.env.PUTZTEUFEL_CLEAN_TIMEOUT_MS = '300';
const { runClean } = await import('../src/application/clean.ts');

const target = (id: number, fields: Partial<Target>): Target => ({ id, key: `k${id}`, plugin: `p${id}`, group: 'test', label: `t${id}`, paths: [], sizePaths: [], listed: [], commands: [], impact: 'regenerates', selected: true, ...fields });

test('a tool command that times out fails only its own item; the run goes on', async () => {
  const root = tempDir();
  write(root, { 'later/file': 'x' });
  const result = await runClean({
    targets: [target(1, { commands: [{ run: 'sleep 5' }] }), target(2, { paths: [path.join(root, 'later')] })],
    install: [],
    uninstallAfter: false,
    hooks: {},
    useTrash: false,
    trashAvailable: false,
  });
  const [slow, later] = result.steps.filter((s) => s.kind === 'item');
  assert.equal(slow.state, 'failed');
  assert.match(slow.detail!, /timed out after 0.3s: sleep 5/);
  assert.equal(later.state, 'done');
  assert.equal(existsSync(path.join(root, 'later')), false);
  assert.equal(result.aborted, false);
});

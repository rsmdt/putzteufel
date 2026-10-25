import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'bun:test';
import { scanAll } from '../src/application/scan.ts';
import type { ScanProgress } from '../src/domain/types.ts';
import { singleItem } from '../src/infrastructure/plugins/build.ts';
import { tempDir, write } from './fixture.ts';
import { start } from './harness.tsx';

const BIN = path.join(import.meta.dir, '..', 'bin', 'putzteufel.ts');

test('the scan reports which plugins and measurements are still running', async () => {
  const root = tempDir();
  write(root, { 'slow/a': 'x' });
  const slow = singleItem({ name: 'Slow tool', list: `sleep 1; echo ${root}/slow`, clean: 'true' });
  const seen: ScanProgress[] = [];
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll([slow], ctx, () => undefined, assert.fail, { onProgress: (p) => seen.push(p) });
  const scanning = seen.find((p) => p.running.some((a) => a.kind === 'scan'))!;
  assert.equal(scanning.running[0].label, 'Slow tool');
  assert.ok(seen.some((p) => p.running.some((a) => a.detail?.startsWith('running: sleep 1'))));
  assert.ok(seen.some((p) => p.running.some((a) => a.kind === 'measure' && a.label.includes('Slow tool'))));
  assert.deepEqual(seen.at(-1), { running: [], found: 1, measured: 1, waiting: 0 });
});

test('the TUI header counts running work and p lists it with elapsed times', async () => {
  const root = tempDir();
  write(root, { 'slow/a': 'x' });
  const slow = singleItem({ name: 'Slow tool', group: 'Test', list: `sleep 3; echo ${root}/slow`, clean: 'true' });
  const { press, waitFor } = await start(root, 180, 32, [slow]);
  await waitFor((f) => f.includes('scanning: 1 running, 0 waiting (p)'), 'header progress');
  await press('p');
  await waitFor((f) => f.includes('Scan progress') && f.includes('Plugins still looking for items') && f.includes('Slow tool') && f.includes('running: sleep 3'), 'activity dialog');
  await waitFor((f) => f.includes('Scan finished: 1 found, 1 measured.') && f.includes('Nothing is running.'), 'finished');
});

test('scan --verbose logs each start and finish; --json emits progress events; slow walks stop', () => {
  const root = tempDir();
  write(root, { 'putzteufel.config.mjs': `export default { plugins: [{ name: 'Slow tool', list: 'sleep 1; echo ${root}/slow', clean: 'true' }] };`, 'slow/a': 'x' });
  const env = { ...process.env, XDG_CONFIG_HOME: tempDir(), PUTZTEUFEL_LOG: path.join(root, 'ops.log') };
  const verbose = Bun.spawnSync(['bun', BIN, 'scan', '--no-projects', '--only', 'Slow tool', '--verbose'], { cwd: root, env });
  const log = verbose.stderr.toString();
  assert.match(log, /start  scan +Slow tool/);
  assert.match(log, /done +\d+\.\ds  Slow tool/);
  const json = Bun.spawnSync(['bun', BIN, 'scan', '--no-projects', '--only', 'Slow tool', '--json'], { cwd: root, env });
  const progress = json.stdout.toString().split('\n').filter((l) => l.includes('"progress"')).map((l) => JSON.parse(l));
  assert.ok(progress.length >= 1);
  assert.equal(progress[0].running[0].label, 'Slow tool');
  write(root, { 'big/a': 'x', 'putzteufel.config.mjs': `export default { plugins: [{ name: 'Big', paths: ['${root}/big'] }] };` });
  const stopped = Bun.spawnSync(['bun', BIN, 'scan', '--no-projects', '--only', 'Big'], { cwd: root, env: { ...env, PUTZTEUFEL_WALK_TIMEOUT_MS: '1' } });
  assert.match(stopped.stderr.toString(), /measuring .*big took too long and was stopped/);
});

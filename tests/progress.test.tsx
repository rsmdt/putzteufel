import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'bun:test';
import { scanAll } from '../src/application/scan.ts';
import type { ScanProgress } from '../src/domain/types.ts';
import { projectsScanner, singleItem } from '../src/infrastructure/plugins/build.ts';
import { builtinPlugins } from '../src/plugins/index.ts';
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

test('busy rows show a spinner, and the preview logs the row’s info first and then each scan step', async () => {
  const root = tempDir();
  write(root, { 'slow/a': 'x' });
  const slow = singleItem({ name: 'Slow tool', group: 'Test', list: `sleep 2; echo ${root}/slow`, clean: 'true' });
  const { frame, press, waitFor } = await start(root, 180, 34, [slow]);
  const row = (f: string) => f.split('\n').find((l) => l.includes('Slow tool') && l.includes('['))! ?? '';
  await waitFor((f) => /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] \[ \] Slow tool  looking for items…/.test(row(f)) && f.includes('scanning: 1 running'), 'placeholder row with a spinner');
  await press('j', 'j');
  await waitFor((f) => /\[INFO\] Slow tool:/.test(f) && /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Looking for items · \d+\.\ds/.test(f) && /^│ +running: sleep 2/m.test(f), 'running step with its live detail');
  await waitFor((f) => f.startsWith('✓') && f.includes('1 found'), 'scan finished');
  await press('TAB', 'j', 'j', 'j', 'j', 'j', 'j');
  await waitFor((f) => /\[INFO\] If removed/.test(f) && /✓ Looked for items: found 1 item · \d+\.\ds/.test(f) && /✓ Measured .*slow: 4\.0K.* · \d+\.\ds/.test(f) && !f.includes('running: sleep 2'), 'finished steps below the info');
  assert.match(row(frame()), /● \[x\] Slow tool/);
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
  write(root, { ...Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [`big/${i % 30}/${i}`, 'x'])), 'putzteufel.config.mjs': `export default { plugins: [{ name: 'Big', paths: ['${root}/big'] }] };` });
  const stopped = Bun.spawnSync(['bun', BIN, 'scan', '--no-projects', '--only', 'Big'], { cwd: root, env: { ...env, PUTZTEUFEL_WALK_TIMEOUT_MS: '1' } });
  assert.match(stopped.stderr.toString(), /measuring .*big took too long and was stopped/);
});

test('commands that leave a child holding the output open still finish, and slow ones time out', async () => {
  const { shell } = await import('../src/infrastructure/shell.ts');
  const startedAt = Date.now();
  assert.equal((await shell('sleep 5 & echo hi')).trim(), 'hi');
  assert.ok(Date.now() - startedAt < 2000, `${Date.now() - startedAt}ms`);
  await assert.rejects(shell('sleep 5', undefined, 300), /timed out after 0.3s: sleep 5/);
  assert.ok(Date.now() - startedAt < 3000);
});

test('a plugin that never finishes is stopped and the scan completes', () => {
  const root = tempDir();
  write(root, { 'putzteufel.config.mjs': `export default { plugins: [{ name: 'Stuck', list: 'sleep 30; echo /tmp', clean: 'true' }] };` });
  const startedAt = Date.now();
  const r = Bun.spawnSync(['bun', BIN, 'scan', '--no-projects', '--only', 'Stuck'], { cwd: root, env: { ...process.env, XDG_CONFIG_HOME: tempDir(), PUTZTEUFEL_PLUGIN_TIMEOUT_MS: '700' } });
  assert.ok(Date.now() - startedAt < 10_000, `${Date.now() - startedAt}ms`);
  assert.match(r.stderr.toString(), /Stuck: stopped looking after 0?\.?7?s?\d*s?; items it found so far are kept|Stuck: stopped looking after/);
  assert.equal(r.exitCode, 0);
});

test('rows that are done show their dot while other plugins keep the scan running', async () => {
  const root = tempDir();
  write(root, { 'app/package.json': '{}', 'app/node_modules/x': 'x', 'slow/a': 'x' });
  const slow = singleItem({ name: 'Slow tool', group: 'Test', list: `sleep 3; echo ${root}/slow`, clean: 'true' });
  const plugins = [projectsScanner(builtinPlugins), slow];
  const { waitFor } = await start(root, 180, 34, plugins);
  const line = (f: string, text: string) => f.split('\n').find((l) => l.includes(text)) ?? '';
  await waitFor((f) => /● \[.\] Node/.test(line(f, 'Node')) && /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] \[ \] Slow tool/.test(line(f, 'Slow tool')), 'Node row done while Slow tool is still looking');
  await waitFor((f) => f.startsWith('✓') && /● \[.\] Slow tool/.test(line(f, 'Slow tool')), 'all done');
});

test('while an item is measured, the preview shows a running step naming its folder', async () => {
  const root = tempDir();
  write(root, { 'slow/a': 'x' });
  const slow = singleItem({ name: 'Slow measure', group: 'Test', list: `echo ${root}/slow`, clean: 'true' });
  const measure = slow.measure.bind(slow);
  slow.measure = async (target) => {
    await Bun.sleep(2500);
    return measure(target);
  };
  const { press, waitFor } = await start(root, 180, 34, [slow]);
  await waitFor((f) => f.includes('] Slow measure'), 'item row');
  await press('j', 'j');
  await waitFor((f) => /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Measuring .*slow · \d+\.\ds/.test(f) && /✓ Looked for items: found 1 item/.test(f), 'running measure step naming the folder');
  await waitFor((f) => f.startsWith('✓') && /✓ Measured .*slow: /.test(f), 'measure step done');
});

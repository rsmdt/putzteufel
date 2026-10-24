import assert from 'node:assert/strict';
import { existsSync, readFileSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { test } from 'bun:test';
import { tempDir, write } from './fixture.ts';

const BIN = path.join(import.meta.dir, '..', 'bin', 'putzteufel.ts');

function run(args: string[], cwd: string) {
  const home = tempDir();
  const result = Bun.spawnSync(['bun', BIN, ...args], { cwd, env: { ...process.env, XDG_CONFIG_HOME: home, PUTZTEUFEL_LOG: path.join(cwd, 'ops.log') } });
  const stdout = result.stdout.toString();
  const events = stdout
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .map((l) => JSON.parse(l));
  return { code: result.exitCode, stdout, stderr: result.stderr.toString(), events, of: (name: string) => events.filter((e) => e.event === name) };
}

function projects(): string {
  const root = tempDir();
  const files = { 'alpha/package.json': '{}', 'alpha/node_modules/x/index.js': 'x', 'bravo/package.json': '{}', 'bravo/node_modules/y': 'y', 'bravo/dist/out.js': 'z' };
  write(root, files);
  const old = new Date(Date.now() - 90 * 86_400_000);
  for (const f of Object.keys(files)) utimesSync(path.join(root, f), old, old);
  return root;
}

const scanOf = (root: string, extra: string[] = []) => run(['scan', root, '--no-caches', '--json', ...extra], root);

test('scan --json streams found, measured and done events with stable keys', () => {
  const root = projects();
  const first = scanOf(root);
  assert.equal(first.code, 0, first.stderr);
  const done = first.of('done')[0];
  assert.equal(done.count, 3);
  assert.equal(first.of('measured').length, 3);
  const alpha = done.targets.find((t: { label: string; item: string }) => t.label === path.join(root, 'alpha'));
  assert.equal(alpha.plugin, 'Node');
  assert.equal(alpha.group, 'JavaScript');
  assert.equal(alpha.section, 'Languages');
  assert.equal(alpha.impact.kind, 'rebuild');
  assert.match(alpha.key, /^[0-9a-f]{12}$/);
  assert.equal(alpha.selected, true);
  const dist = done.targets.find((t: { item: string }) => t.item === 'Build output');
  assert.equal(dist.selected, false);
  assert.equal(dist.selectedReason, 'unknown items are only removed when picked');
  assert.equal(scanOf(root).of('done')[0].targets.find((t: { label: string }) => t.label === alpha.label).key, alpha.key);
});

test('selectors pick by key, plugin, item, impact and filter', () => {
  const root = projects();
  const all = scanOf(root).of('done')[0].targets;
  const keyOf = (label: string, item = 'Dependencies') => all.find((t: { label: string; item: string }) => t.label === path.join(root, label) && t.item === item).key;
  const selected = (extra: string[]) => scanOf(root, extra).of('done')[0].selected.sort();
  assert.deepEqual(selected(['--key', keyOf('bravo', 'Build output')]), [keyOf('bravo', 'Build output')]);
  assert.deepEqual(selected(['--impact', 'unknown']), [keyOf('bravo', 'Build output')]);
  assert.deepEqual(selected(['--item', 'Node/Dependencies', '--filter', 'alpha']), [keyOf('alpha')]);
  assert.deepEqual(selected(['--plugin', 'node', '--exclude-key', keyOf('alpha')]).length, 2);
  assert.equal(selected(['--all']).length, 3);
  assert.equal(selected(['--older-than', '365']).length, 0);
  assert.equal(selected(['--older-than', '30']).length, 2);
});

test('plan shows what would happen; clean without --yes removes nothing and exits 3', () => {
  const root = projects();
  const plan = run(['plan', root, '--no-caches', '--json'], root);
  assert.equal(plan.code, 0, plan.stderr);
  const { plan: p, exact } = plan.of('plan')[0];
  assert.equal(p.items.length, 2);
  assert.ok(p.notes.some((n: { text: string }) => n.text.startsWith('No Trash: 2 folder(s) will be deleted permanently and cannot be recovered')));
  assert.deepEqual(p.items[0].paths.map((x: { how: string }) => x.how), ['delete']);
  assert.ok(exact.total > 0);
  const dry = run(['clean', root, '--no-caches'], root);
  assert.equal(dry.code, 3);
  assert.match(dry.stdout, /Nothing was removed\. Run the same command with --yes to clean\./);
  assert.ok(existsSync(path.join(root, 'alpha/node_modules')));
});

test('clean --yes removes the selection, streams steps, logs operations, and history reads them', () => {
  const root = projects();
  const all = scanOf(root).of('done')[0].targets;
  const alpha = all.find((t: { label: string }) => t.label === path.join(root, 'alpha')).key;
  const clean = run(['clean', root, '--no-caches', '--key', alpha, '--yes', '--json'], root);
  assert.equal(clean.code, 0, clean.stderr);
  assert.equal(existsSync(path.join(root, 'alpha/node_modules')), false);
  assert.equal(existsSync(path.join(root, 'bravo/node_modules')), true);
  const steps = clean.of('step').map((e) => `${e.step.kind}:${e.step.state}`);
  assert.deepEqual(steps, ['item:running', 'item:done']);
  assert.equal(clean.of('step')[1].step.key, alpha);
  assert.deepEqual(clean.of('done')[0].cleaned, [alpha]);
  const log = readFileSync(path.join(root, 'ops.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(log[0].result, 'done');
  const history = run(['history', '--json'], root);
  assert.equal(history.of('operation')[0].operation.label, path.join(root, 'alpha'));
});

test('files lists an item’s entries; failures follow --on-failure; bad input is a usage error', () => {
  const root = projects();
  const all = scanOf(root).of('done')[0].targets;
  const alpha = all.find((t: { label: string }) => t.label === path.join(root, 'alpha')).key;
  const files = run(['files', alpha, root, '--no-caches', '--json'], root);
  assert.deepEqual(files.of('files')[0].entries.map((e: { name: string }) => e.name), ['x']);
  assert.equal(files.of('files')[0].dir, path.join(root, 'alpha/node_modules'));

  write(root, { 'putzteufel.config.mjs': `export default { plugins: [{ name: 'Flaky', paths: ['${root}/flaky'], clean: 'echo nope >&2; exit 4' }] };`, 'flaky/a': 'x' });
  const failing = run(['clean', '--no-projects', '--only', 'Flaky', '--plugin', 'Flaky', '--on-failure', 'retry:2', '--yes', '--json'], root);
  assert.equal(failing.code, 2);
  assert.deepEqual(failing.of('failure').map((e) => e.decision), ['retry', 'retry', 'skip']);

  assert.equal(run(['files', 'nope', root, '--no-caches'], root).code, 1);
  assert.equal(run(['clean', '--on-failure', 'sometimes'], root).code, 1);
});

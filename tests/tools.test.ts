import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { type Target } from '../src/domain/types.ts';
import { forgetWhich } from '../src/infrastructure/shell.ts';
import { singleItem } from '../src/infrastructure/plugins/build.ts';
import { missingTools } from '../src/domain/run-plan.ts';
import { runClean } from '../src/application/clean.ts';
import { scanAll } from '../src/application/scan.ts';
import { tempDir, write } from './fixture.ts';

function setup() {
  const root = tempDir();
  const bin = path.join(root, 'bin');
  const journal = path.join(root, 'journal');
  write(root, {
    'cache/fakecache/blob': 'x'.repeat(5000),
    'other/stuff': 'y',
    'bin/fakebrew': `#!/bin/sh
echo "brew $*" >> "${journal}"
if [ "$1" = install ]; then printf '#!/bin/sh\\necho "fakecache $*" >> "${journal}"\\nrm -rf "${root}/cache/fakecache"\\n' > "${bin}/fakecache"; chmod +x "${bin}/fakecache"; fi
if [ "$1" = uninstall ]; then rm -f "${bin}/fakecache"; fi
`,
  });
  chmodSync(path.join(bin, 'fakebrew'), 0o755);
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH}`;
  forgetWhich();
  const spec = {
    name: 'Fake cache',
    group: 'Test',
    tool: { bin: 'fakecache', install: 'fakebrew install fakecache', uninstall: 'fakebrew uninstall fakecache' },
    paths: [`${root}/cache/fakecache`],
    list: 'fakecache dir',
    clean: 'fakecache clean',
    hooks: { before: `echo "plugin before" >> "${journal}"`, after: `echo "plugin after" >> "${journal}"` },
  };
  return { root, bin, journal, spec };
}

async function scan(spec: Parameters<typeof singleItem>[0]): Promise<Target[]> {
  const found: Target[] = [];
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll([singleItem(spec)], ctx, (t) => found.push(t), assert.fail);
  return found;
}

test('a missing tool still finds its default folder and is offered for install', async () => {
  const { root, spec } = setup();
  const [target] = await scan(spec);
  assert.deepEqual(target.paths, [path.join(root, 'cache/fakecache')]);
  assert.deepEqual(target.commands, []);
  assert.equal(target.tool?.installed, false);
  assert.deepEqual(target.tool?.clean, [{ run: 'fakecache clean' }]);
  assert.deepEqual(missingTools([target]).map((t) => t.install), ['fakebrew install fakecache']);
});

test('install, native clean, hooks and uninstall run in order', async () => {
  const { root, bin, journal, spec } = setup();
  const [target] = await scan(spec);
  const result = await runClean({ targets: [target], install: missingTools([target]), uninstallAfter: true, hooks: { before: `echo "run before" >> "${journal}"`, after: `echo "run after" >> "${journal}"` }, useTrash: false, trashAvailable: false });
  assert.deepEqual(readFileSync(journal, 'utf8').trim().split('\n'), ['run before', 'brew install fakecache', 'plugin before', 'fakecache clean', 'plugin after', 'brew uninstall fakecache', 'run after']);
  assert.equal(existsSync(path.join(root, 'cache/fakecache')), false);
  assert.equal(existsSync(path.join(bin, 'fakecache')), false);
  assert.equal(result.cleaned.has(target.id), true);
  assert.deepEqual(result.steps.map((s) => `${s.kind}:${s.state}`), ['hook:done', 'install:done', 'hook:done', 'item:done', 'hook:done', 'uninstall:done', 'hook:done']);
  assert.equal(result.steps.find((s) => s.kind === 'item')?.detail, 'Ran fakecache clean');
});

test('an unchecked tool falls back to deleting the folder; a failed install skips the item', async () => {
  const { root, journal, spec } = setup();
  const [target] = await scan(spec);
  const direct = await runClean({ targets: [target], install: [], uninstallAfter: true, hooks: {}, useTrash: false, trashAvailable: false });
  assert.equal(direct.steps.find((s) => s.kind === 'item')?.detail, 'Deleted 1 folder');
  assert.equal(existsSync(path.join(root, 'cache/fakecache')), false);
  assert.ok(!readFileSync(journal, 'utf8').includes('brew'));

  write(root, { 'cache/fakecache/blob': 'x' });
  const [again] = await scan(spec);
  const broken = { ...again.tool!, install: 'false' };
  const failed = await runClean({ targets: [again], install: [broken], uninstallAfter: true, hooks: {}, useTrash: false, trashAvailable: false });
  assert.equal(existsSync(path.join(root, 'cache/fakecache')), true);
  const kinds = (kind: string) => failed.steps.find((s) => s.kind === kind)!;
  assert.equal(kinds('install').state, 'failed');
  assert.equal(kinds('item').state, 'skipped');
  assert.equal(kinds('item').detail, 'fakecache could not be installed');
});

test('a failing before hook stops the run before anything is removed', async () => {
  const { root, spec } = setup();
  const [target] = await scan(spec);
  const stopped = await runClean({ targets: [target], install: [], uninstallAfter: false, hooks: { before: 'exit 3' }, useTrash: false, trashAvailable: false });
  assert.equal(existsSync(path.join(root, 'cache/fakecache')), true);
  assert.equal(stopped.aborted, true);
  assert.equal(stopped.steps[0].state, 'failed');
  assert.ok(stopped.steps.slice(1).every((s) => s.state === 'skipped'));
});

test('an installed tool reports its own location and cleans natively', async () => {
  const { root, bin, journal, spec } = setup();
  write(bin, { fakecache: `#!/bin/sh\nif [ "$1" = dir ]; then echo "${root}/other"; else echo "fakecache $*" >> "${journal}"; fi\n` });
  chmodSync(path.join(bin, 'fakecache'), 0o755);
  forgetWhich();
  const [target] = await scan(spec);
  assert.deepEqual(target.paths, [path.join(root, 'other')]);
  assert.deepEqual(target.commands, [{ run: 'fakecache clean' }]);
  assert.equal(target.tool?.installed, true);
  assert.deepEqual(missingTools([target]), []);
});

test('a tool whose own lookup fails falls back to its default folder and is not offered for install', async () => {
  const { root, bin, spec } = setup();
  write(bin, { fakecache: '#!/bin/sh\necho "cache disabled" >&2\nexit 1\n' });
  chmodSync(path.join(bin, 'fakecache'), 0o755);
  forgetWhich();
  const [target] = await scan(spec);
  assert.deepEqual(target.paths, [path.join(root, 'cache/fakecache')]);
  assert.deepEqual(target.commands, []);
  assert.equal(target.tool?.broken, 'cache disabled');
  assert.deepEqual(missingTools([target]), []);
});

test('a failing item asks what to do: retry, skip, skip all or abort', async () => {
  const root = tempDir();
  write(root, { 'one/a': 'x', 'two/b': 'x', 'three/c': 'x', flag: '' });
  const target = (id: number, name: string, run: string): Target => ({ id, key: String(id), plugin: 'P', group: 'C', label: path.join(root, name), paths: [path.join(root, name)], sizePaths: [], listed: [], commands: [{ run }], impact: 'regenerates', selected: true, size: 10 });
  const flaky = `if [ -f "${root}/flag" ]; then rm "${root}/flag"; exit 1; fi; rm -rf "${root}/one"`;
  const asked: string[] = [];
  const answers = ['retry', 'abort'] as const;
  const result = await runClean(
    { targets: [target(1, 'one', flaky), target(2, 'two', 'exit 1'), target(3, 'three', `rm -rf "${root}/three"`)], install: [], uninstallAfter: false, hooks: { after: 'true' }, useTrash: false, trashAvailable: false },
    { onFailure: async (step) => (asked.push(step.label), answers[asked.length - 1]) },
  );
  assert.equal(asked.length, 2);
  assert.equal(existsSync(path.join(root, 'one')), false);
  assert.equal(existsSync(path.join(root, 'three')), true);
  assert.equal(result.aborted, true);
  assert.deepEqual(result.steps.map((s) => s.state), ['done', 'failed', 'skipped', 'done']);
  assert.equal(result.freed, 10);

  write(root, { 'four/d': 'x' });
  let questions = 0;
  const skipping = await runClean(
    { targets: [target(4, 'x1', 'exit 1'), target(5, 'x2', 'exit 1'), target(6, 'four', `rm -rf "${root}/four"`)], install: [], uninstallAfter: false, hooks: {}, useTrash: false, trashAvailable: false },
    { onFailure: async () => (questions++, 'skipAll') },
  );
  assert.equal(questions, 1);
  assert.deepEqual(skipping.steps.map((s) => s.state), ['failed', 'failed', 'done']);
});

test('stopping a run kills the running command, skips the rest and still runs the after hook', async () => {
  const root = tempDir();
  write(root, { 'one/a': 'x', 'two/b': 'x' });
  const target = (id: number, name: string, run: string): Target => ({ id, key: String(id), plugin: 'P', group: 'C', label: path.join(root, name), paths: [path.join(root, name)], sizePaths: [], listed: [], commands: [{ run }], impact: 'regenerates', selected: true, size: 10 });
  const controller = new AbortController();
  const startedAt = Date.now();
  let asked = 0;
  const result = await runClean(
    { targets: [target(1, 'one', 'sleep 30'), target(2, 'two', `rm -rf "${root}/two"`)], install: [], uninstallAfter: false, hooks: { after: `touch "${root}/after"` }, useTrash: false, trashAvailable: false },
    { onStep: (step) => step.state === 'running' && step.id === 'item:1' && setTimeout(() => controller.abort(), 200), onFailure: async () => (asked++, 'skip') },
    controller.signal,
  );
  assert.ok(Date.now() - startedAt < 5000, `${Date.now() - startedAt}ms`);
  assert.equal(result.aborted, true);
  assert.equal(asked, 0);
  assert.deepEqual(result.steps.map((s) => s.state), ['failed', 'skipped', 'done']);
  assert.equal(existsSync(path.join(root, 'two')), true);
  assert.equal(existsSync(path.join(root, 'after')), true);
});

import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'bun:test';
import { type Target, forgetWhich } from '../src/core.ts';
import { SpecPlugin } from '../src/plugins.ts';
import { missingTools, runClean } from '../src/run.ts';
import { scanAll } from '../src/scan.ts';
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
    category: 'Test',
    tool: { bin: 'fakecache', install: 'fakebrew install fakecache', uninstall: 'fakebrew uninstall fakecache' },
    paths: [`${root}/cache/fakecache`],
    list: 'fakecache dir',
    clean: 'fakecache clean',
    hooks: { before: `echo "plugin before" >> "${journal}"`, after: `echo "plugin after" >> "${journal}"` },
  };
  return { root, bin, journal, spec };
}

async function scan(spec: ConstructorParameters<typeof SpecPlugin>[0]): Promise<Target[]> {
  const found: Target[] = [];
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll([new SpecPlugin(spec)], ctx, (t) => found.push(t), assert.fail);
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
  const log: string[] = [];
  const result = await runClean(
    { targets: [target], install: missingTools([target]), uninstallAfter: true, hooks: { before: `echo "run before" >> "${journal}"`, after: `echo "run after" >> "${journal}"` }, useTrash: false },
    (line) => log.push(line),
  );
  assert.deepEqual(readFileSync(journal, 'utf8').trim().split('\n'), ['run before', 'brew install fakecache', 'plugin before', 'fakecache clean', 'plugin after', 'brew uninstall fakecache', 'run after']);
  assert.equal(existsSync(path.join(root, 'cache/fakecache')), false);
  assert.equal(existsSync(path.join(bin, 'fakecache')), false);
  assert.equal(result.cleaned.has(target.id), true);
  assert.ok(log.includes('✓ installed fakecache'));
});

test('an unchecked tool falls back to deleting the folder; a failed install skips the item', async () => {
  const { root, journal, spec } = setup();
  const [target] = await scan(spec);
  await runClean({ targets: [target], install: [], uninstallAfter: true, hooks: {}, useTrash: false }, () => undefined);
  assert.equal(existsSync(path.join(root, 'cache/fakecache')), false);
  assert.ok(!readFileSync(journal, 'utf8').includes('brew'));

  write(root, { 'cache/fakecache/blob': 'x' });
  const [again] = await scan(spec);
  const log: string[] = [];
  const broken = { ...again.tool!, install: 'false' };
  await runClean({ targets: [again], install: [broken], uninstallAfter: true, hooks: {}, useTrash: false }, (line) => log.push(line));
  assert.equal(existsSync(path.join(root, 'cache/fakecache')), true);
  assert.ok(log.some((l) => l.includes('skipped, fakecache could not be installed')));
});

test('a failing before hook stops the run before anything is removed', async () => {
  const { root, spec } = setup();
  const [target] = await scan(spec);
  const log: string[] = [];
  await runClean({ targets: [target], install: [], uninstallAfter: false, hooks: { before: 'exit 3' }, useTrash: false }, (line) => log.push(line));
  assert.equal(existsSync(path.join(root, 'cache/fakecache')), true);
  assert.ok(log.includes('Stopped: the before hook failed, nothing was removed.'));
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

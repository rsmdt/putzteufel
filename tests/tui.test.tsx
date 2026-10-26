import assert from 'node:assert/strict';
import { existsSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { act } from 'react';
import { chmodSync, readFileSync } from 'node:fs';
import { forgetWhich } from '../src/infrastructure/shell.ts';
import { singleItem } from '../src/infrastructure/plugins/build.ts';
import { tempDir, write } from './fixture.ts';
import { start, twoProjects } from './harness.tsx';

test('select, confirm and clean through the TUI', async () => {
  const root = twoProjects();
  const { frame, press, waitFor } = await start(root);

  await waitFor((f) => f.includes('2/2') && !f.includes('scanning'), 'scan');
  await press('/', ...'bravo', 'RETURN');
  await waitFor((f) => f.includes(path.join(root, 'bravo')), 'filtered row');
  await press('j', 'j', 'j', ' ');
  await waitFor((f) => f.includes('1 selected'), 'deselect');

  await press('d');
  await waitFor((f) => f.includes('Permanently delete 1 item') && f.includes('No Trash: 1 folder(s) will be deleted permanently and cannot be recovered'), 'confirm screen warns');
  assert.ok(frame().includes('node_modules  deleted permanently'));
  assert.ok(frame().includes(path.join(root, 'alpha')));
  assert.ok(!frame().includes(path.join(root, 'bravo')));

  await press('y');
  await waitFor((f) => /Cleaned 1 of 1 item\(s\)/.test(f), 'clean finished');
  assert.equal(existsSync(path.join(root, 'alpha/node_modules')), false);
  assert.equal(existsSync(path.join(root, 'bravo/node_modules')), true);
  const log = readFileSync(process.env.PUTZTEUFEL_LOG!, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const entry = log.find((e) => e.label === path.join(root, 'alpha'));
  assert.equal(entry.result, 'done');
  assert.deepEqual(entry.paths, [{ path: path.join(root, 'alpha/node_modules'), how: 'delete' }]);

  await press('ESCAPE');
  await waitFor((f) => f.includes('2 found') && /\[ \].*alpha.*█{10} ✓ /.test(f), 'the cleaned row stays until the next rescan');
});

test('the file browser lists what an item contains before anything is removed', async () => {
  const root = twoProjects();
  const { press, waitFor } = await start(root);
  await waitFor((f) => f.includes('2/2') && !f.includes('scanning'), 'scan');
  await press('j', 'j', 'RETURN', 'j');
  await waitFor((f) => f.includes(path.join(root, 'alpha')), 'expanded plugin');
  await press('f');
  await waitFor((f) => f.includes('big.bin') && f.includes('x/'), 'file listing');
  await press('j', 'RETURN');
  await waitFor((f) => f.includes('index.js'), 'nested folder');
  await press('h', 'h');
  await waitFor((f) => f.includes('enter/f files'), 'back to list');
  assert.equal(existsSync(path.join(root, 'alpha/node_modules/big.bin')), true);
});

test('the age keys preselect only items older than the threshold', async () => {
  const root = twoProjects();
  const old = new Date(Date.now() - 100 * 86_400_000);
  for (const f of ['alpha/package.json', 'alpha/package-lock.json', 'alpha/node_modules/x/index.js', 'alpha/node_modules/big.bin', 'alpha/node_modules/x', 'alpha/node_modules']) utimesSync(path.join(root, f), old, old);
  const { frame, press, burst, waitFor } = await start(root);
  await waitFor((f) => f.includes('2/2') && !f.includes('scanning'), 'scan');
  assert.ok(frame().includes('any age'));
  await burst(']]]]]');
  await waitFor((f) => f.includes('older than 30d') && f.includes('1/2'), 'threshold 30d');
  await press(...']]]]');
  await waitFor((f) => f.includes('older than 365d') && f.includes('0/2'), 'threshold 365d');
  await press('[', '[', '[');
  await waitFor((f) => f.includes('older than 60d') && f.includes('1/2'), 'threshold 60d');
});

test('the map shows a sunburst, toggles to a treemap, and clicks move the cursor', async () => {
  const root = twoProjects();
  const { setup, frame, press, waitFor, exited } = await start(root, 140, 32);
  await waitFor((f) => f.includes('2/2') && !f.includes('scanning'), 'scan');
  assert.ok(frame().includes('sunburst'));
  assert.ok(/[▀▄]/.test(frame()));
  await press('m');
  await waitFor((f) => f.includes('treemap · m hide'), 'treemap');
  await press('j', 'j', 'RETURN');
  await waitFor((f) => f.includes(path.join(root, 'alpha')), 'expanded');
  const mapLeft = 140 - Math.floor(140 * 0.42);
  await act(async () => setup.mockMouse.click(mapLeft + 3, 5));
  await waitFor((f) => f.includes('Items 4/5') && f.includes('[INFO] If removed (rebuild)'), 'clicked item at the cursor and in the preview');
  await press('m');
  await waitFor((f) => !f.includes('treemap'), 'map hidden');
  await press('q');
  assert.equal(exited(), true);
});

test('impact tags are explained in the preview, the help screen and the review screen', async () => {
  const root = twoProjects();
  const { frame, press, waitFor } = await start(root);
  await waitFor((f) => f.includes('2/2') && !f.includes('scanning'), 'scan');
  assert.ok(frame().includes(' rebuild'));
  await press('j', 'j', 'RETURN', 'j');
  await waitFor((f) => f.includes('If removed (rebuild): The next install or build recreates it.') && f.includes('npm/pnpm/yarn/bun install'), 'impact explanation');
  assert.ok(frame().includes('Selected by default: rebuild items are recreated without losing anything.'));
  await press('?');
  await waitFor((f) => f.includes('HELP') && f.includes('Every key, from the same list the footer uses') && f.includes('first row'), 'help screen lists every key');
  await press('/', ...'tags', 'RETURN');
  await waitFor((f) => f.includes('What the tags mean') && f.includes('data loss') && f.includes('Never selected by default.'), 'help search finds the tag legend');
  await press('ESCAPE');
  await waitFor((f) => !f.includes('HELP'), 'help closed');
  await press('d');
  await waitFor((f) => f.includes('Permanently delete 2 item(s)') && /2 rebuild\s+\S+\s+The next install/.test(f), 'review summary by impact');
  await press('n');
});

test('missing native tools are offered for install, with uninstall afterwards', async () => {
  const root = tempDir();
  const bin = path.join(root, 'bin');
  const journal = path.join(root, 'journal');
  write(root, {
    'cache/fakecache/blob': 'x'.repeat(5000),
    'bin/fakebrew': `#!/bin/sh\necho "brew $*" >> "${journal}"\nif [ "$1" = install ]; then printf '#!/bin/sh\\necho "fakecache $*" >> "${journal}"\\nrm -rf "${root}/cache/fakecache"\\n' > "${bin}/fakecache"; chmod +x "${bin}/fakecache"; fi\nif [ "$1" = uninstall ]; then rm -f "${bin}/fakecache"; fi\n`,
  });
  chmodSync(path.join(bin, 'fakebrew'), 0o755);
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH}`;
  forgetWhich();
  const plugin = singleItem({
    name: 'Fake cache',
    group: 'Test',
    tool: { bin: 'fakecache', install: 'fakebrew install fakecache', uninstall: 'fakebrew uninstall fakecache' },
    paths: [`${root}/cache/fakecache`],
    list: 'fakecache dir',
    clean: 'fakecache clean',
  });
  const { frame, press, waitFor } = await start(root, 200, 30, [plugin]);
  await waitFor((f) => f.includes('1/1') && !f.includes('scanning'), 'scan');
  await press('j', 'j');
  await waitFor((f) => f.includes('fakecache is not installed: the folders are deleted directly.') && f.includes('d offers to install it first (fakebrew install fakecache)'), 'tool status in preview');

  await press('d');
  await waitFor((f) => f.includes('Native tools') && f.includes('[x] fakecache') && f.includes('$ fakebrew install fakecache') && f.includes('[x] Uninstall the tools'), 'tools screen');
  await press(' ', 'RETURN');
  await waitFor((f) => f.includes('fakecache not installed: the folders below are deleted directly'), 'unchecked tool means direct delete');
  assert.ok(!frame().includes('install:      $'));
  await press('n', 'd', 'RETURN');
  await waitFor((f) => f.includes('install:      $ fakebrew install fakecache') && f.includes('then remove:  $ fakebrew uninstall fakecache') && f.includes('$ fakecache clean   (after install)'), 'review shows the install plan');
  await press('y');
  await waitFor((f) => /Cleaned 1 of 1 item\(s\)/.test(f), 'clean finished');
  assert.deepEqual(readFileSync(journal, 'utf8').trim().split('\n'), ['brew install fakecache', 'fakecache clean', 'brew uninstall fakecache']);
});

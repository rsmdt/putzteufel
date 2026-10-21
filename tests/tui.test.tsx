import assert from 'node:assert/strict';
import { existsSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { act } from 'react';
import { chmodSync, readFileSync } from 'node:fs';
import { builtinRules } from '../src/plugins/builtin/index.ts';
import { type Plugin, forgetWhich } from '../src/core/index.ts';
import { SpecPlugin } from '../src/plugins/spec.ts';
import { ProjectsPlugin } from '../src/plugins/projects.ts';
import { App } from '../src/tui/App.tsx';
import { tempDir, write } from './fixture.ts';

let dispose: (() => void) | undefined;
afterEach(() => dispose?.());

async function start(root: string, width = 200, height = 30, plugins: Plugin[] = [new ProjectsPlugin(builtinRules)]) {
  const ctx = { roots: [root], exclude: [], olderThan: 0, recentDays: 0 };
  let exited = false;
  const setup = await testRender(<App plugins={plugins} ctx={ctx} onExit={() => (exited = true)} />, { width, height });
  dispose = () => setup.renderer.destroy();
  const frame = () => setup.captureCharFrame();
  const settle = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    await setup.renderOnce();
  };
  const press = async (...keys: string[]) => {
    for (const key of keys) {
      await act(async () => setup.mockInput.pressKey(key));
      await settle();
    }
  };
  const waitFor = async (check: (f: string) => boolean, what: string) => {
    for (let i = 0; i < 200; i++) {
      await settle();
      if (check(frame())) return;
    }
    assert.fail(`timed out waiting for ${what}:\n${frame()}`);
  };
  const burst = async (keys: string) => {
    await act(async () => {
      for (const key of keys) setup.mockInput.pressKey(key);
    });
    await settle();
  };
  return { setup, frame, press, burst, waitFor, exited: () => exited };
}

function twoProjects(): string {
  const root = tempDir();
  write(root, { 'alpha/package.json': '{}', 'alpha/node_modules/x/index.js': 'x', 'alpha/node_modules/big.bin': 'y'.repeat(50_000), 'bravo/package.json': '{}', 'bravo/node_modules/y': 'y' });
  return root;
}

test('select, confirm and clean through the TUI', async () => {
  const root = twoProjects();
  const { frame, press, waitFor } = await start(root);

  await waitFor((f) => f.includes('2/2') && !f.includes('scanning'), 'scan');
  await press('/', ...'bravo', 'RETURN');
  await waitFor((f) => f.includes(path.join(root, 'bravo')), 'filtered row');
  await press('j', 'j', ' ');
  await waitFor((f) => f.includes('1 selected'), 'deselect');

  await press('d');
  await waitFor((f) => f.includes('Permanently delete 1 item'), 'confirm screen');
  assert.ok(frame().includes(path.join(root, 'alpha')));
  assert.ok(!frame().includes(path.join(root, 'bravo')));

  await press('y');
  await waitFor((f) => f.includes('Done.'), 'clean finished');
  assert.equal(existsSync(path.join(root, 'alpha/node_modules')), false);
  assert.equal(existsSync(path.join(root, 'bravo/node_modules')), true);

  await press('RETURN');
  await waitFor((f) => f.includes('1 found'), 'list after clean');
});

test('the file browser lists what an item contains before anything is removed', async () => {
  const root = twoProjects();
  const { press, waitFor } = await start(root);
  await waitFor((f) => f.includes('2/2') && !f.includes('scanning'), 'scan');
  await press('j', 'RETURN', 'j');
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
  for (const f of ['alpha/package.json', 'alpha/node_modules/x/index.js', 'alpha/node_modules/big.bin', 'alpha/node_modules/x', 'alpha/node_modules']) utimesSync(path.join(root, f), old, old);
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
  await press('j', 'RETURN');
  await waitFor((f) => f.includes(path.join(root, 'alpha')), 'expanded');
  const mapLeft = 140 - Math.floor(140 * 0.42);
  await act(async () => setup.mockMouse.click(mapLeft + 3, 5));
  await waitFor((f) => f.includes('node_modules/big.bin'), 'clicked item in preview');
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
  await press('j', 'RETURN', 'j');
  await waitFor((f) => f.includes('If removed (rebuild): The next install or build recreates it.') && f.includes('npm/pnpm/yarn/bun install'), 'impact explanation');
  assert.ok(frame().includes('Selected by default: rebuild items are recreated without losing anything.'));
  await press('?');
  await waitFor((f) => f.includes('What the tags mean') && f.includes('data loss') && f.includes('Never selected by default.'), 'help screen');
  await press('x');
  await waitFor((f) => f.includes('? tags'), 'help closed');
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
  const plugin = new SpecPlugin({
    name: 'Fake cache',
    category: 'Test',
    tool: { bin: 'fakecache', install: 'fakebrew install fakecache', uninstall: 'fakebrew uninstall fakecache' },
    paths: [`${root}/cache/fakecache`],
    list: 'fakecache dir',
    clean: 'fakecache clean',
  });
  const { frame, press, waitFor } = await start(root, 200, 30, [plugin]);
  await waitFor((f) => f.includes('1/1') && !f.includes('scanning'), 'scan');
  await press('j');
  await waitFor((f) => f.includes('fakecache is not installed: the folders are deleted directly.') && f.includes('d offers to install it first (fakebrew install fakecache)'), 'tool status in preview');

  await press('d');
  await waitFor((f) => f.includes('native tools') && f.includes('[x] fakecache') && f.includes('$ fakebrew install fakecache') && f.includes('[x] Uninstall the tools'), 'tools screen');
  await press(' ', 'RETURN');
  await waitFor((f) => f.includes('fakecache not installed: the folders below are deleted directly'), 'unchecked tool means direct delete');
  assert.ok(!frame().includes('install:      $'));
  await press('n', 'd', 'RETURN');
  await waitFor((f) => f.includes('install:      $ fakebrew install fakecache') && f.includes('then remove:  $ fakebrew uninstall fakecache') && f.includes('$ fakecache clean   (after install)'), 'review shows the install plan');
  await press('y');
  await waitFor((f) => f.includes('Done.'), 'clean finished');
  assert.deepEqual(readFileSync(journal, 'utf8').trim().split('\n'), ['brew install fakecache', 'fakecache clean', 'brew uninstall fakecache']);
});

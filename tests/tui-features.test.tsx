import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'bun:test';
import { act } from 'react';
import { loadState, saveState, statePath } from '../src/config/state.ts';
import { builtinRules } from '../src/plugins/builtin/index.ts';
import { ProjectsPlugin } from '../src/plugins/projects.ts';
import { SpecPlugin } from '../src/plugins/spec.ts';
import { tempDir, write } from './fixture.ts';
import { start, twoProjects } from './harness.tsx';

const ready = (f: string) => f.includes('2/2') && !f.includes('scanning');
const lines = (f: string) => f.split('\n');

test('O1 footer hints shorten by priority at 80 columns and keep the essential ones', async () => {
  const { frame, waitFor } = await start(twoProjects(), 80, 30);
  await waitFor(ready, 'scan');
  const footer = lines(frame()).filter((l) => l.trim()).at(-1)!.trimEnd();
  assert.ok(footer.length <= 80);
  for (const hint of ['space toggle', 'd clean', '? help', 'q quit']) assert.ok(footer.includes(hint), `${hint} in "${footer}"`);
  assert.ok(!footer.includes('rescan'));
});

test('O3 warnings go to the message bar and w opens the message log', async () => {
  const root = twoProjects();
  const broken = new SpecPlugin({ name: 'Broken lister', category: 'Test', list: 'echo boom >&2; exit 3' });
  const { frame, press, waitFor } = await start(root, 160, 30, [new ProjectsPlugin(builtinRules), broken]);
  await waitFor((f) => ready(f) && f.includes('Broken lister: Command failed'), 'warning in the message bar');
  await press('w');
  await waitFor((f) => f.includes('Messages (1)') && f.includes('warn') && f.includes('boom'), 'message log');
  await press('ESCAPE');
  await waitFor((f) => !f.includes('Messages (1)'), 'log closed');
  assert.ok(frame().includes('LIST'));
});

test('O4 tab moves focus to the preview and the map, and arrows walk the map', async () => {
  const root = twoProjects();
  const { press, waitFor } = await start(root, 160, 32);
  await waitFor(ready, 'scan');
  await press('TAB');
  await waitFor((f) => f.includes('PREVIEW'), 'preview focused');
  await press('TAB');
  await waitFor((f) => f.includes('MAP') && f.includes('←→ slices'), 'map focused');
  await press('ARROW_DOWN');
  await waitFor((f) => f.includes('Node: 2/2'), 'into the Node group');
  await press('ARROW_DOWN');
  await waitFor((f) => f.includes(`${path.join(root, 'alpha')}  ·`), 'into the largest item');
  await press('ARROW_RIGHT');
  await waitFor((f) => f.includes(`${path.join(root, 'bravo')}  ·`), 'next slice');
  await press('ARROW_UP');
  await waitFor((f) => f.includes('Node: 2/2'), 'back out');
});

test('O5 O12 O13 the mode pill, fuzzy filter and a designed empty state', async () => {
  const root = twoProjects();
  const { frame, press, waitFor } = await start(root);
  await waitFor(ready, 'scan');
  assert.ok(lines(frame())[0].includes('LIST'));
  await press('/');
  await waitFor((f) => lines(f)[0].includes('FILTER'), 'filter pill');
  await press(...'brv', 'RETURN');
  await waitFor((f) => f.includes(path.join(root, 'bravo')) && !f.includes(path.join(root, 'alpha')), 'fuzzy match brv → bravo');
  await press('/', 'BACKSPACE', 'BACKSPACE', 'BACKSPACE', ...'zzq', 'RETURN');
  await waitFor((f) => f.includes('No item matches “zzq”.') && f.includes('esc clear the filter'), 'empty state with the next key');
  await press('ESCAPE');
  await waitFor((f) => ready(f) && !f.includes('No item matches'), 'filter cleared');
});

test('O6 O7 the progress panel shows each step and a failed item asks to retry, skip or abort', async () => {
  const root = tempDir();
  write(root, { 'good/a': 'x', 'bad/b': 'y' });
  const good = new SpecPlugin({ name: 'Good', category: 'Test', paths: [path.join(root, 'good')], clean: `rm -rf "${path.join(root, 'good')}"` });
  const bad = new SpecPlugin({ name: 'Bad', category: 'Test', paths: [path.join(root, 'bad')], clean: 'echo nope >&2; exit 7' });
  const { frame, press, waitFor } = await start(root, 160, 32, [good, bad]);
  await waitFor((f) => f.includes('2 found') && !f.includes('scanning'), 'scan');
  await press('d');
  await waitFor((f) => f.includes('(y) Clean now'), 'review buttons');
  await press('y');
  await waitFor((f) => lines(f)[0].includes('FAILED') && f.includes('(r) Retry') && f.includes('(S) Skip all') && f.includes('nope'), 'failure prompt');
  await press('r');
  await waitFor((f) => f.includes('(r) Retry'), 'asked again after retry');
  await press('s');
  await waitFor((f) => f.includes('Cleanup finished') && f.includes('2/2 items') && f.includes('Done.'), 'progress summary');
  assert.ok(frame().includes('Ran rm -rf'));
  await press('RETURN');
  await waitFor((f) => f.includes('Cleaned 1 of 2 item(s)') && f.includes('1 step(s) failed'), 'result in the message bar');
});

test('O8 going up in the file browser lands on the folder you came from', async () => {
  const root = twoProjects();
  const { press, waitFor } = await start(root);
  await waitFor(ready, 'scan');
  await press('j', 'RETURN', 'j', 'f');
  await waitFor((f) => f.includes('big.bin') && f.includes('x/'), 'files');
  await press('j', 'RETURN');
  await waitFor((f) => f.includes('index.js') && f.includes('FILES'), 'inside x');
  await press('ARROW_LEFT');
  await waitFor((f) => f.includes(`${path.join(root, 'alpha/node_modules/x')}  ·`), 'cursor back on x/');
});

test('O9 O10 sort picker and reverse, shown in the frame titles', async () => {
  const root = twoProjects();
  const { frame, press, waitFor } = await start(root);
  await waitFor(ready, 'scan');
  await press('j', 'RETURN');
  await waitFor((f) => f.includes(path.join(root, 'alpha')) && f.includes('Items 2/4') && f.includes('size ↓ · 2 selected'), 'titles');
  await press('o');
  await waitFor((f) => f.includes('SORT') && f.includes('Name'), 'sort picker');
  await press('j', 'j', 'RETURN');
  await waitFor((f) => f.includes('name ↓'), 'sorted by name');
  await press('R');
  await waitFor((f) => f.includes('name ↑'), 'reversed');
  const f = frame();
  assert.ok(f.indexOf(path.join(root, 'bravo')) < f.indexOf(path.join(root, 'alpha')));
});

test('O11 a too-small terminal says what size is needed', async () => {
  const { waitFor } = await start(twoProjects(), 50, 12);
  await waitFor((f) => f.includes('Terminal too small') && f.includes('width 50 of 60') && f.includes('height 12 of 16'), 'too small');
});

test('O11 a hidden map says why', async () => {
  const { waitFor } = await start(twoProjects(), 80, 30);
  await waitFor((f) => f.includes('map needs 90+ columns, has 80'), 'map note');
});

test('O14 dialogs dim what is behind them', async () => {
  const { setup, press, waitFor } = await start(twoProjects(), 160, 30);
  await waitFor(ready, 'scan');
  const fg = () => setup.captureSpans().lines[0].spans.find((s) => s.text.includes('found'))!.fg.buffer[0];
  const before = fg();
  await press('?');
  await waitFor((f) => f.includes('HELP'), 'help');
  assert.ok(fg() < before, `${fg()} < ${before}`);
});

test('O15 the first run shows a welcome once and remembers it', async () => {
  const saved: object[] = [];
  const { frame, press, waitFor } = await start(twoProjects(), 160, 30, undefined, { firstRun: true, onSaveState: (p) => saved.push(p) });
  await waitFor((f) => f.includes('Welcome to putzteufel') && f.includes('Nothing is removed until you press d'), 'welcome');
  await press('x');
  await waitFor((f) => !f.includes('Welcome to putzteufel'), 'dismissed');
  assert.deepEqual(saved, [{ welcomed: true }]);
  assert.ok(frame().includes('LIST'));

  const home = tempDir();
  process.env.XDG_CONFIG_HOME = home;
  await saveState({ welcomed: true });
  await saveState({ theme: 'light' });
  assert.equal(statePath(), path.join(home, 'putzteufel', 'state.json'));
  assert.deepEqual(await loadState(), { welcomed: true, theme: 'light' });
  delete process.env.XDG_CONFIG_HOME;
});

test('O16 the theme picker previews live, restores on esc and saves on enter; ascii icons', async () => {
  const saved: object[] = [];
  const { setup, press, waitFor } = await start(twoProjects(), 160, 30, undefined, { onSaveState: (p) => saved.push(p) });
  await waitFor(ready, 'scan');
  const accent = () => [...setup.captureSpans().lines[0].spans.find((s) => s.text.includes('putzteufel'))!.fg.buffer].join(',');
  const dark = accent();
  await press('T');
  await waitFor((f) => f.includes('THEME') && f.includes('high contrast'), 'picker');
  await press('j', 'ESCAPE');
  await waitFor((f) => !f.includes('THEME'), 'closed');
  assert.equal(accent(), dark);
  await press('T', 'j', 'RETURN');
  await waitFor((f) => f.includes('Theme "light" saved.'), 'saved');
  assert.notEqual(accent(), dark);
  assert.deepEqual(saved, [{ theme: 'light' }]);

  const ascii = await start(twoProjects(), 160, 30, undefined, { icons: 'ascii' });
  await ascii.waitFor(ready, 'scan');
  await act(async () => undefined);
  assert.ok(ascii.frame().includes('* Projects') && !ascii.frame().includes('●') && !/[▀▄]/.test(ascii.frame()));
});

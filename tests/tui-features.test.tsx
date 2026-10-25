import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'bun:test';
import { act } from 'react';
import { loadState, saveState, statePath } from '../src/infrastructure/store/state.ts';
import { builtinPlugins } from '../src/plugins/index.ts';
import { projectsScanner } from '../src/infrastructure/plugins/build.ts';
import { singleItem } from '../src/infrastructure/plugins/build.ts';
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

test('O3 warnings go to the message bar, and there is no separate message log', async () => {
  const root = twoProjects();
  const broken = singleItem({ name: 'Broken lister', group: 'Test', list: 'echo boom >&2; exit 3' });
  const { frame, press, waitFor } = await start(root, 160, 30, [projectsScanner(builtinPlugins), broken]);
  await waitFor((f) => ready(f) && f.includes('Broken lister: Command failed'), 'warning in the message bar');
  assert.ok(!frame().includes('w shows all'));
  await press('w');
  await waitFor((f) => lines(f)[0].includes('LIST') && !f.includes('Messages ('), 'w opens nothing');
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
  await waitFor((f) => f.includes('JavaScript: 2/2'), 'into the JavaScript ecosystem');
  await press('ARROW_DOWN');
  await waitFor((f) => f.includes('Node: 2/2'), 'into the Node plugin');
  await press('ARROW_DOWN');
  await waitFor((f) => f.includes(`[INFO] ${path.join(root, 'alph')}`), 'into the largest item');
  await press('ARROW_RIGHT');
  await waitFor((f) => f.includes(`[INFO] ${path.join(root, 'brav')}`), 'next slice');
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

test('O6 O7 a cleanup runs in the main screen: rows show their progress and the preview logs each step', async () => {
  const root = tempDir();
  write(root, { 'good/a': 'x', 'bad/b': 'y' });
  const good = singleItem({ name: 'Good', group: 'Test', paths: [path.join(root, 'good')], clean: `rm -rf "${path.join(root, 'good')}"` });
  const bad = singleItem({ name: 'Bad', group: 'Test', paths: [path.join(root, 'bad')], clean: 'echo nope >&2; exit 7' });
  const { frame, press, waitFor } = await start(root, 160, 32, [good, bad]);
  await waitFor((f) => f.includes('2 found') && !f.includes('scanning'), 'scan');
  await press('d');
  await waitFor((f) => f.includes('(y) Clean now'), 'review buttons');
  await press('y');
  const row = (f: string, name: string) => f.split('\n').find((l) => l.includes(`${name}  via`)) ?? '';
  await waitFor((f) => !f.includes('(y) Clean now') && /\[ \].*█{10} ✓ /.test(row(f, 'Good')) && /\[x\].*✗ failed/.test(row(f, 'Bad')), 'rows end with their state; the failed one stays selected');
  await waitFor((f) => f.includes('Cleaned 1 of 2 item(s)') && f.includes('1 step(s) failed'), 'result in the message bar');
  assert.ok(lines(frame())[0].includes('LIST'));
  await press('g', 'j', 'j', 'j');
  await waitFor((f) => /✗ Could not clean .*nope · \d+\.\ds/.test(f), 'failed step and its error in the preview');
  await press('d');
  await waitFor((f) => f.includes('(y) Clean now') && f.includes('1 item'), 'd again reviews only the failed item');
});

test('esc stops a running cleanup; the run is locked until then', async () => {
  const root = tempDir();
  write(root, { 'slow/a': 'x' });
  const slow = singleItem({ name: 'Slow', group: 'Test', paths: [path.join(root, 'slow')], clean: 'sleep 30' });
  const { frame, press, waitFor } = await start(root, 160, 32, [slow]);
  await waitFor((f) => f.includes('1 found') && !f.includes('scanning'), 'scan');
  await press('d');
  await waitFor((f) => f.includes('(y) Clean now'), 'review buttons');
  await press('y');
  await waitFor((f) => lines(f)[0].includes('CLEANING') && /[█░]{10} running/.test(f) && f.includes('esc stops') && /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Cleaning Slow · \d+\.\ds/.test(f) && f.includes('sleep 30'), 'row bar, header mode, footer hint and running step in the preview');
  await press(' ');
  await waitFor((f) => f.includes('A cleanup is running'), 'selection is locked');
  await press('q');
  await waitFor((f) => f.includes('press esc to stop it first'), 'quit is locked too');
  const startedAt = Date.now();
  await press('ESCAPE');
  await waitFor((f) => f.includes('Cleaned 0 of 1 item(s)') && f.includes('aborted') && lines(f)[0].includes('LIST'), 'stopped');
  assert.ok(Date.now() - startedAt < 5000);
  assert.match(frame(), /✗ failed/);
});

test('O8 going up in the file browser lands on the folder you came from', async () => {
  const root = twoProjects();
  const { press, waitFor } = await start(root);
  await waitFor(ready, 'scan');
  await press('j', 'j', 'RETURN', 'j', 'f');
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
  await press('j', 'j', 'RETURN');
  await waitFor((f) => f.includes(path.join(root, 'alpha')) && f.includes('Items 3/5') && f.includes('size ↓ · 2 selected'), 'titles');
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
  assert.ok(ascii.frame().includes('* JavaScript') && !ascii.frame().includes('●') && !/[▀▄]/.test(ascii.frame()));
});

test('a spinner at the top left runs while scanning and turns into a check when done', async () => {
  const root = tempDir();
  write(root, { 'slow/a': 'x' });
  const slow = singleItem({ name: 'Slow', group: 'Test', list: `sleep 1; echo ${path.join(root, 'slow')}`, clean: 'true' });
  const { frame, waitFor } = await start(root, 160, 30, [slow]);
  await waitFor((f) => /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] /.test(lines(f)[0]), 'spinner while scanning');
  await waitFor((f) => lines(f)[0].startsWith('✓ ') && f.includes('1 found'), 'check when done');
  assert.ok(!lines(frame())[0].includes('scanning'));
});

test('a folder two plugins claim is listed under both, counted once and cleaned once', async () => {
  const root = tempDir();
  const shared = path.join(root, 'cache/tool');
  write(root, { 'cache/tool/blob': 'x'.repeat(40_000), 'cache/other/b': 'y' });
  const journal = path.join(root, 'journal');
  const tool = singleItem({ name: 'Tool', group: 'Test', list: `echo ${shared}`, clean: `echo tool >> "${journal}"; rm -rf "${shared}"` });
  const generic = singleItem({ name: 'Generic', group: 'Test', paths: [`${root}/cache/*`], fallback: true });
  const { frame, press, waitFor } = await start(root, 180, 34, [tool, generic]);
  await waitFor((f) => f.includes('3 found') && lines(f)[0].startsWith('✓'), 'scan');
  await press('e');
  await waitFor((f) => f.includes('also: Generic') && f.includes('also: Tool'), 'both rows tagged');
  const header = lines(frame())[0];
  await press('a');
  await press('a');
  await waitFor((f) => f.includes('3 selected'), 'all selected');
  const toFree = /([\d.]+K) to free/.exec(lines(frame())[0])![1];
  assert.ok(Number.parseFloat(toFree) < 90, `${toFree} counts the shared folder once (${header})`);
  await press('j', 'j', 'j');
  await waitFor((f) => f.includes('Also touched by'), 'preview explains the overlap');
  await press('d');
  await waitFor((f) => f.includes('lie inside another selected item'), 'review mentions it');
  await press('y');
  await waitFor((f) => /Cleaned \d of 3 item\(s\)/.test(f), 'cleaned');
  assert.match(frame(), /↷ skipped/);
  assert.equal((await Bun.file(journal).text()).trim(), 'tool');
});

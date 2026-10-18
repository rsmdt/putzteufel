import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { render } from 'ink-testing-library';
import React from 'react';
import { builtinRules } from '../src/builtin.ts';
import { ProjectsPlugin } from '../src/projects.ts';
import { App } from '../src/tui.tsx';
import { tempDir, write } from './fixture.ts';

async function waitFor(check: () => boolean, what: string, frame: () => string | undefined): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail(`timed out waiting for ${what}:\n${frame()}`);
}

test('select, confirm and clean through the TUI', async () => {
  const root = tempDir();
  write(root, { 'alpha/package.json': '{}', 'alpha/node_modules/x': 'x', 'bravo/package.json': '{}', 'bravo/node_modules/y': 'y' });
  const ctx = { roots: [root], exclude: [], olderThan: 0, recentDays: 0 };
  const { lastFrame, stdin, unmount } = render(<App plugins={[new ProjectsPlugin(builtinRules)]} ctx={ctx} />);
  const frame = () => lastFrame() ?? '';
  const press = async (keys: string) => {
    stdin.write(keys);
    await new Promise((r) => setTimeout(r, 60));
  };

  await waitFor(() => frame().includes('2/2') && !frame().includes('scanning'), 'scan', frame);
  await press('/');
  for (const ch of 'bravo') await press(ch);
  await press('\r');
  await waitFor(() => frame().includes(`${path.join(root, 'bravo')}`), 'filtered row', frame);
  await press('j');
  await press('j');
  await press(' ');
  await waitFor(() => frame().includes('1 selected'), 'deselect', frame);

  await press('d');
  await waitFor(() => frame().includes('Permanently delete 1 item'), 'confirm screen', frame);
  assert.ok(frame().includes(path.join(root, 'alpha')));
  assert.ok(!frame().includes(path.join(root, 'bravo')));

  await press('y');
  await waitFor(() => frame().includes('Done.'), 'clean finished', frame);
  assert.equal(existsSync(path.join(root, 'alpha/node_modules')), false);
  assert.equal(existsSync(path.join(root, 'bravo/node_modules')), true);

  await press('\r');
  await waitFor(() => frame().includes('1 found'), 'list after clean', frame);
  unmount();
});

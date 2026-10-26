import assert from 'node:assert/strict';
import { afterEach } from 'node:test';
import { testRender } from '@opentui/react/test-utils';
import { act } from 'react';
import { type Plugin } from '../src/domain/types.ts';
import { builtinPlugins } from '../src/plugins/index.ts';
import { projectsScanner } from '../src/infrastructure/plugins/build.ts';
import { App, type AppProps } from '../src/interfaces/tui/App.tsx';
import { installed, tempDir, write } from './fixture.ts';

process.env.PUTZTEUFEL_LOG = `${tempDir()}/operations.log`;

let dispose: (() => void) | undefined;
afterEach(() => dispose?.());

export async function start(root: string, width = 200, height = 30, plugins: Plugin[] = [projectsScanner(builtinPlugins)], props: Partial<AppProps> = {}) {
  const ctx = { roots: [root], exclude: [], olderThan: 0, recentDays: 0 };
  let exited = false;
  const setup = await testRender(<App plugins={plugins} ctx={ctx} onExit={() => (exited = true)} {...props} />, { width, height });
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

export function twoProjects(): string {
  const root = tempDir();
  write(root, { 'alpha/package.json': '{}', 'alpha/node_modules/x/index.js': 'x'.repeat(10_000), 'alpha/node_modules/big.bin': 'y'.repeat(50_000), 'bravo/package.json': '{}', 'bravo/node_modules/y': 'y' });
  installed(root, 'alpha', 'bravo');
  return root;
}


import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, rmSync, symlinkSync, utimesSync } from 'node:fs';
import { HOME } from '../src/domain/paths.ts';
import path from 'node:path';
import { test } from 'node:test';
import { type Plugin, type Target } from '../src/domain/types.ts';
import { builtinPlugins } from '../src/plugins/index.ts';
import nix from '../src/plugins/nix.ts';
import { oldBundledVersions } from '../src/plugins/claude.ts';
import { leftoverProfiles } from '../src/plugins/playwright.ts';
import { oldDeviceSupport, unusedRuntimes } from '../src/plugins/xcode.ts';
import { pluginsFrom, projectsScanner, singleItem } from '../src/infrastructure/plugins/build.ts';
import { cleanTarget } from '../src/infrastructure/remove.ts';
import { forgetWhich } from '../src/infrastructure/shell.ts';
import { scanAll } from '../src/application/scan.ts';
import { installed, tempDir, write } from './fixture.ts';

const SIGNATURE = 'Signature: 8a477f597d28d172789f06886806bc55\n# This file is a cache directory tag.\n';

async function scan(plugins: Plugin[], roots: string[] = []): Promise<{ found: Target[]; errors: string[] }> {
  const found: Target[] = [];
  const errors: string[] = [];
  const ctx = { roots, exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(plugins, ctx, (t) => found.push(t), (m) => errors.push(m));
  return { found, errors };
}

const scanProjects = (root: string) => scan([projectsScanner(builtinPlugins)], [root]);

const old = new Date('2020-01-01');
const canListProcesses = spawnSync('pgrep', ['-f', 'putzteufel-no-such-process']).status === 1;

test('a folder with a valid CACHEDIR.TAG is offered once, under the plugin that knows it best', async () => {
  const root = tempDir();
  write(root, {
    'tool/.thing-cache/CACHEDIR.TAG': SIGNATURE,
    'tool/.thing-cache/blob': 'x',
    'tool/fake/CACHEDIR.TAG': 'not a tag',
    'rust/Cargo.toml': '',
    'rust/target/CACHEDIR.TAG': SIGNATURE,
  });
  const { found } = await scanProjects(root);
  assert.deepEqual(found.map((t) => `${t.plugin}/${t.item} ${path.relative(root, t.paths[0])}`).sort(), ['CACHEDIR.TAG/Tagged cache tool/.thing-cache', 'Cargo/target rust/target']);
});

test('a tool whose list names the home folder, or a link to it, is skipped and nothing is offered', async () => {
  const root = tempDir();
  symlinkSync(HOME, path.join(root, 'home-link'));
  for (const target of [HOME, path.join(root, 'home-link')]) {
    const { found, errors } = await scan([singleItem({ name: 'Greedy', list: `echo ${target}`, clean: 'true' })]);
    assert.deepEqual(found, []);
    assert.match(errors.join('\n'), /never cleans; skipped/);
  }
});

test('node_modules is only preselected when the lockfile and install record match and nothing changed since', async () => {
  const root = tempDir();
  write(root, {
    'clean/package.json': '{}',
    'clean/node_modules/a/index.js': 'x',
    'edited/package.json': '{}',
    'edited/node_modules/a/index.js': 'x',
    'bare/package.json': '{}',
    'bare/node_modules/a/index.js': 'x',
  });
  installed(root, 'clean', 'edited');
  const later = new Date(Date.now() + 120_000);
  utimesSync(path.join(root, 'edited/node_modules/a/index.js'), later, later);
  const { found } = await scanProjects(root);
  const of = (name: string) => found.find((t) => t.label === path.join(root, name))!;
  assert.equal(of('clean').impact, 'rebuild');
  assert.equal(of('edited').impact, 'unknown');
  assert.match(of('edited').note!, /index\.js changed after the last install/);
  assert.equal(of('bare').impact, 'unknown');
  assert.match(of('bare').note!, /no lockfile and install record/);
});

test('a project with a process running inside it is not preselected', async () => {
  const root = tempDir();
  write(root, { 'busy/package.json': '{}', 'busy/node_modules/a': 'x' });
  installed(root, 'busy');
  const child = spawn('sleep', ['30'], { cwd: path.join(root, 'busy') });
  try {
    await new Promise((r) => setTimeout(r, 200));
    const { found } = await scanProjects(root);
    assert.equal(found[0].impact, 'unknown');
    assert.match(found[0].note!, /A process is running in/);
    assert.equal(found[0].selected, false);
  } finally {
    child.kill();
  }
});

test('a folder replaced between the scan and the clean is left in place', async () => {
  const root = tempDir();
  write(root, { 'p/package.json': '{}', 'p/node_modules/a': 'x' });
  installed(root, 'p');
  const { found } = await scanProjects(root);
  const modules = path.join(root, 'p/node_modules');
  rmSync(modules, { recursive: true });
  write(root, { 'p/node_modules/swapped': 'y' });
  const { errors } = await cleanTarget(found[0], { useTrash: false, trashAvailable: false });
  assert.match(errors.join(), /was replaced since the scan, left in place/);
  assert.ok(existsSync(path.join(modules, 'swapped')));
});

test('device support keeps the two newest versions per platform', async () => {
  const root = tempDir();
  ['17.0', '17.4', '18.0'].forEach((v, i) => {
    mkdirSync(path.join(root, 'iOS DeviceSupport', v), { recursive: true });
    const at = new Date(Date.UTC(2024, i, 1));
    utimesSync(path.join(root, 'iOS DeviceSupport', v), at, at);
  });
  mkdirSync(path.join(root, 'watchOS DeviceSupport/10.0'), { recursive: true });
  const drafts = await oldDeviceSupport(path.join(root, '*DeviceSupport'));
  assert.deepEqual(drafts.map((d) => path.relative(root, d.label)), ['iOS DeviceSupport/17.0']);
});

test('a simulator runtime is offered only when it is ready, deletable, the only image for its id, and no device uses it', () => {
  const image = (rid: string, extra = {}) => ({ runtimeIdentifier: rid, version: '17.2', build: '21C62', sizeBytes: 7e9, deletable: true, state: 'Ready', ...extra });
  const images = {
    A: image('com.apple.CoreSimulator.SimRuntime.iOS-17-2'),
    B: image('com.apple.CoreSimulator.SimRuntime.iOS-18-0'),
    C: image('com.apple.CoreSimulator.SimRuntime.watchOS-10-0', { deletable: false }),
    D: image('com.apple.CoreSimulator.SimRuntime.tvOS-17-0'),
    E: image('com.apple.CoreSimulator.SimRuntime.tvOS-17-0'),
  };
  const devices = { devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [{ udid: '1' }] } };
  const drafts = unusedRuntimes(images, devices);
  assert.deepEqual(
    drafts.map((d) => [d.label, d.size, d.commands![0].run]),
    [['iOS 17.2 (21C62)', 7e9, 'xcrun simctl runtime delete A']],
  );
  assert.deepEqual(unusedRuntimes(images, {}), []);
});

test('old Claude Code versions in Claude Desktop are offered only when the active one is known and Claude is closed', async () => {
  const root = tempDir();
  write(root, { 'claude-code-vm/.sdk-version': '2.1.308\n', 'claude-code-vm/2.1.308/x': 'x', 'claude-code-vm/2.1.200/x': 'x', 'claude-code/2.1.308/x': 'x', 'claude-code/2.0.1/x': 'x' });
  const closed = async () => false;
  const drafts = await oldBundledVersions(root, closed);
  assert.deepEqual(drafts.map((d) => path.relative(root, d.label)).sort(), ['claude-code-vm/2.1.200', 'claude-code/2.0.1']);
  assert.deepEqual(await oldBundledVersions(root, async () => true), []);
  rmSync(path.join(root, 'claude-code/2.1.308'), { recursive: true });
  assert.deepEqual(await oldBundledVersions(root, closed), []);
  write(root, { 'claude-code-vm/.sdk-version': '../../etc' });
  assert.deepEqual(await oldBundledVersions(root, closed), []);
});

test('automation browser profiles are offered once they are two hours old and no process uses them', { skip: !canListProcesses && 'pgrep cannot list processes here' }, async () => {
  const root = tempDir();
  for (const name of ['playwright_chromiumdev_profile-old', 'playwright_chromiumdev_profile-busy', 'playwright_chromiumdev_profile-new', 'unrelated']) mkdirSync(path.join(root, name));
  for (const name of ['playwright_chromiumdev_profile-old', 'playwright_chromiumdev_profile-busy', 'unrelated']) utimesSync(path.join(root, name), old, old);
  const busy = spawn('sh', ['-c', 'sleep 30; :', 'sh', path.join(root, 'playwright_chromiumdev_profile-busy')]);
  try {
    await new Promise((r) => setTimeout(r, 200));
    const drafts = await leftoverProfiles(root);
    assert.deepEqual(drafts.map((d) => path.basename(d.label)), ['playwright_chromiumdev_profile-old']);
  } finally {
    busy.kill();
  }
});

test('Nix offers unreachable store paths through nix-store --gc and never deletes folders itself', async () => {
  const root = tempDir();
  write(root, { 'bin/nix-store': '#!/bin/sh\n[ "$*" = "--gc --print-dead" ] && printf "/nix/store/a\\n/nix/store/b\\n"\n' });
  chmodSync(path.join(root, 'bin/nix-store'), 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${path.join(root, 'bin')}${path.delimiter}${saved}`;
  forgetWhich();
  try {
    const [target] = (await scan(pluginsFrom([nix], { projects: false }))).found;
    assert.deepEqual(target.listed, ['2 store paths no profile or GC root uses']);
    assert.deepEqual(target.paths, []);
    assert.deepEqual(target.commands, [{ run: 'nix-store --gc' }]);
  } finally {
    process.env.PATH = saved;
    forgetWhich();
  }
});

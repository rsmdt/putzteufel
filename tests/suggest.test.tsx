import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { forgetWhich } from '../src/infrastructure/shell.ts';
import { singleItem } from '../src/infrastructure/plugins/build.ts';
import { tempDir, write } from './fixture.ts';
import { start } from './harness.tsx';

const BIN = path.join(import.meta.dirname, '..', 'bin', 'putzteufel.ts');
const ORIGINAL_PATH = process.env.PATH;

afterEach(() => {
  process.env.PATH = ORIGINAL_PATH;
  forgetWhich();
});

function fakeTools() {
  const root = tempDir();
  const bin = path.join(root, 'bin');
  const journal = path.join(root, 'journal');
  write(root, {
    'cache/fakecache/blob': 'x'.repeat(5000),
    'bin/fakebrew': `#!/bin/sh\necho "brew $*" >> "${journal}"\nif [ "$1" = install ]; then printf '#!/bin/sh\\necho "fakecache $*" >> "${journal}"\\n' > "${bin}/fakecache"; chmod +x "${bin}/fakecache"; fi\nif [ "$1" = uninstall ]; then rm -f "${bin}/fakecache"; fi\n`,
  });
  chmodSync(path.join(bin, 'fakebrew'), 0o755);
  const spec = { name: 'Fake cache', tool: { bin: 'fakecache', install: 'fakebrew install fakecache', uninstall: 'fakebrew uninstall fakecache' }, paths: [`${root}/cache/fakecache`], clean: 'fakecache clean' };
  return { root, bin, journal, spec };
}

test('the TUI proposes a missing tool during the scan and installs it on request', async () => {
  const { root, bin, journal, spec } = fakeTools();
  process.env.PATH = `${bin}${path.delimiter}${ORIGINAL_PATH}`;
  forgetWhich();
  const { press, waitFor } = await start(root, 200, 34, [singleItem({ ...spec, group: 'Test' })]);
  await waitFor((f) => f.includes('Suggested: fakecache would clean Fake cache') && f.includes('1 tool suggestion (i)'), 'suggestion during the scan');
  await press('i');
  await waitFor((f) => f.includes('Suggested tools') && f.includes('[x] fakecache') && f.includes('Nothing is removed yet'), 'suggestions dialog');
  await press('j', ' ', 'RETURN');
  await waitFor((f) => f.includes('Installed fakecache; its items are rescanned') && !f.includes('tool suggestion'), 'installed and rescanned');
  assert.deepEqual(readFileSync(journal, 'utf8').trim().split('\n'), ['brew install fakecache']);
  await waitFor((f) => f.startsWith('✓') && f.includes('1 found'), 'rescan finished');
  await press('G');
  await waitFor((f) => f.includes('Cleaned by its own tool: $ fakecache clean'), 'item now uses the tool');
  await press('d');
  await waitFor((f) => f.includes('then remove:  $ fakebrew uninstall fakecache'), 'review offers to uninstall what was installed earlier');
});

test('scan --json reports suggestions and tools installs them only with --yes', () => {
  const { root, bin, journal, spec } = fakeTools();
  write(root, { 'putzteufel.config.mjs': `export default { plugins: [${JSON.stringify(spec)}] };` });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${ORIGINAL_PATH}`, XDG_CONFIG_HOME: tempDir(), PUTZTEUFEL_LOG: path.join(root, 'ops.log') };
  const run = (args: string[]) => {
    const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), BIN, ...args, '--no-projects', '--only', 'Fake cache'], { cwd: root, env });
    return { code: r.status, stdout: r.stdout.toString(), events: r.stdout.toString().split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)) };
  };
  const scan = run(['scan', '--json']);
  const suggestion = scan.events.find((e) => e.event === 'suggestion').suggestion;
  assert.equal(suggestion.bin, 'fakecache');
  assert.equal(suggestion.install, 'fakebrew install fakecache');
  assert.equal(suggestion.items.length, 1);
  assert.match(run(['scan']).stdout, /Suggested: fakecache would clean Fake cache .* putzteufel tools --install fakecache --yes/);
  const dry = run(['tools', '--install', 'fakecache']);
  assert.equal(dry.code, 3);
  assert.throws(() => readFileSync(journal));
  const real = run(['tools', '--install', 'fakecache', '--yes', '--json']);
  assert.equal(real.code, 0);
  assert.deepEqual(real.events.filter((e) => e.event === 'install').map((e) => [e.bin, e.ok]), [['fakecache', true]]);
  assert.equal(run(['scan', '--json']).events.filter((e) => e.event === 'suggestion').length, 0);
});

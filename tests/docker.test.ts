import assert from 'node:assert/strict';
import { chmodSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { builtinPlugins } from '../src/plugins/builtin/index.ts';
import type { Target } from '../src/core/index.ts';
import { SpecPlugin } from '../src/plugins/spec.ts';
import { scanAll } from '../src/engine/scan.ts';
import { tempDir, write } from './fixture.ts';

const FAKE_DOCKER = `#!/bin/sh
case "$1 $2" in
  "info "*) exit 0 ;;
  "ps -aq") echo c1 ;;
  "ps -a") echo "web  nginx  Exited (0) 2 days ago  1.1kB" ;;
  "inspect --format") case "$3" in *Networks*) echo "USED n1 " ;; *) echo "USED sha256:used" ;; esac ;;
  "images --no-trunc") printf 'sha256:used  nginx:latest  180MB\\nsha256:old  node:18  1.1GB\\n' ;;
  "images -f") echo "abc123  3 weeks ago  500MB" ;;
  "volume ls") echo "deadbeef" ;;
  "network ls") printf 'n1  app_default  bridge\\nn2  old_net  bridge\\n' ;;
  "buildx du") echo "Total: 2.3GB" ;;
esac
`;

test('docker plugins list only unused resources and clean with docker prune', async () => {
  const bin = tempDir();
  write(bin, { docker: FAKE_DOCKER });
  chmodSync(path.join(bin, 'docker'), 0o755);
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH}`;
  const specs = builtinPlugins.filter((p) => p.name.startsWith('Docker'));
  const found: Target[] = [];
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(specs.map((s) => new SpecPlugin(s)), ctx, (t) => found.push(t), assert.fail);
  const byName = Object.fromEntries(found.map((t) => [t.plugin, t]));
  assert.deepEqual(byName['Docker unused images'].listed, ['sha256:old  node:18  1.1GB']);
  assert.deepEqual(byName['Docker unused networks'].listed, ['n2  old_net  bridge']);
  assert.deepEqual(byName['Docker stopped containers'].listed, ['web  nginx  Exited (0) 2 days ago  1.1kB']);
  assert.deepEqual(byName['Docker dangling images'].listed, ['abc123  3 weeks ago  500MB']);
  assert.deepEqual(byName['Docker unused volumes'].listed, ['deadbeef']);
  assert.deepEqual(byName['Docker build cache'].listed, ['Total: 2.3GB']);
  assert.deepEqual(byName['Docker unused volumes'].commands, [{ run: 'docker volume prune -af' }]);
  assert.equal(byName['Docker unused volumes'].selected, false);
  assert.equal(byName['Docker build cache'].selected, true);
});

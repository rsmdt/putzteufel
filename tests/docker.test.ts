import assert from 'node:assert/strict';
import { chmodSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { builtinPlugins } from '../src/plugins/index.ts';
import { type Target } from '../src/domain/types.ts';
import { describeCommand } from '../src/domain/command.ts';
import { pluginsFrom } from '../src/infrastructure/plugins/build.ts';
import { repoReference } from '../src/plugins/huggingface.ts';
import { scanAll } from '../src/application/scan.ts';
import { tempDir, write } from './fixture.ts';

const FAKE_DOCKER = `#!/bin/sh
case "$*" in
  "info") exit 0 ;;
  "ps -aq") echo c1 ;;
  inspect*Networks*) echo "n1 " ;;
  "inspect --format {{.Image}} c1") echo sha256:used ;;
  "images --no-trunc -f dangling=true"*) echo '{"ID":"sha256:dangle0000000000","Repository":"<none>","Tag":"<none>","CreatedAt":"2024-01-01 10:00:00 +0000 UTC","CreatedSince":"2 years ago","Size":"500MB"}' ;;
  "images --no-trunc"*) printf '%s\\n' '{"ID":"sha256:used","Repository":"nginx","Tag":"latest","CreatedAt":"2026-10-20 10:00:00 +0200 CEST","Size":"180MB"}' '{"ID":"sha256:old","Repository":"node","Tag":"18","CreatedAt":"2025-01-05 08:30:00 +0100 CET","CreatedSince":"21 months ago","Size":"1.1GB"}' '{"ID":"sha256:dangle0000000000","Repository":"<none>","Tag":"<none>","CreatedAt":"2024-01-01 10:00:00 +0000 UTC","Size":"500MB"}' ;;
  "ps -a -s"*) echo '{"ID":"c1","Names":"web","Image":"nginx","Status":"Exited (0) 2 days ago","CreatedAt":"2026-10-01 12:00:00 +0000 UTC","Size":"1.1kB (virtual 180MB)"}' ;;
  "volume ls"*) echo '{"Name":"deadbeef"}' ;;
  "volume inspect"*) echo "deadbeef|2020-01-01T00:00:00Z" ;;
  "network ls"*) printf '%s\\n' '{"ID":"n1","Name":"app_default","Driver":"bridge"}' '{"ID":"n2","Name":"old_net","Driver":"bridge"}' ;;
  "network inspect"*) echo "old_net|2021-06-01T09:00:00.123456789Z" ;;
  "buildx du") echo "Total: 2.3GB" ;;
esac
`;

test('Docker lists each unused object with its size and age, removed with docker itself', async () => {
  const bin = tempDir();
  write(bin, { docker: FAKE_DOCKER });
  chmodSync(path.join(bin, 'docker'), 0o755);
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH}`;
  const docker = builtinPlugins.filter((p) => p.name === 'Docker');
  const found: Target[] = [];
  const ctx = { roots: [], exclude: [], olderThan: 0, recentDays: 0, signal: new AbortController().signal };
  await scanAll(pluginsFrom(docker, { projects: false }), ctx, (t) => found.push(t), assert.fail);
  assert.ok(found.every((t) => t.plugin === 'Docker' && t.group === 'Containers'));
  const by = (item: string) => found.filter((t) => t.item === item);
  assert.deepEqual(by('Unused images').map((t) => t.label), ['node:18']);
  assert.deepEqual(by('Unused images')[0].commands, [{ run: 'docker rmi sha256:old' }]);
  assert.equal(by('Unused images')[0].size, 1_100_000_000);
  assert.ok(by('Unused images')[0].ageDays! > 365);
  assert.deepEqual(by('Dangling images').map((t) => t.label), ['dangle000000']);
  assert.deepEqual(by('Stopped containers').map((t) => [t.label, t.commands[0].run]), [['web', 'docker rm c1']]);
  assert.equal(by('Stopped containers')[0].size, 1100);
  assert.deepEqual(by('Unused volumes').map((t) => [t.label, t.commands[0].run, Math.floor(t.ageDays!) > 2000]), [['deadbeef', "docker volume rm 'deadbeef'", true]]);
  assert.deepEqual(by('Unused networks').map((t) => [t.label, t.commands[0].run]), [['old_net', 'docker network rm n2']]);
  assert.ok(by('Unused networks')[0].ageDays! > 365);
  assert.deepEqual(by('Build cache')[0].listed, ['Total: 2.3GB']);
  assert.equal(by('Unused volumes')[0].selected, false);
  assert.equal(by('Build cache')[0].selected, true);
  assert.equal(describeCommand(by('Build cache')[0].commands[0], 30), 'docker builder prune -af --filter until=720h');
  assert.equal(describeCommand(by('Build cache')[0].commands[0]), 'docker builder prune -af');
});

test('Hugging Face cache folders map to hf repo references', () => {
  assert.equal(repoReference('/h/.cache/huggingface/hub/models--ds4sd--docling-models'), 'model/ds4sd/docling-models');
  assert.equal(repoReference('/h/.cache/huggingface/hub/datasets--nyu-mll--glue'), 'dataset/nyu-mll/glue');
  assert.equal(repoReference('/h/.cache/huggingface/hub/models--gpt2'), 'model/gpt2');
});

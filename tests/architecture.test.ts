import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const SRC = path.join(import.meta.dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

function layerOf(file: string): string {
  return path.relative(SRC, file).split(path.sep)[0];
}

function imports(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/(?:from |import\()'([^']+)'/g)].map((m) => m[1]);
}

const ALLOWED: Record<string, string[]> = {
  domain: ['domain'],
  plugins: ['domain', 'plugins', 'infrastructure'],
  infrastructure: ['domain', 'infrastructure', 'plugins'],
  application: ['domain', 'infrastructure', 'application', 'plugins'],
  interfaces: ['domain', 'infrastructure', 'application', 'plugins', 'interfaces'],
};

const PURE_NODE = new Set(['node:path', 'node:os', 'node:crypto']);

test('each layer only depends on the layers inside it', () => {
  const violations: string[] = [];
  for (const file of files(SRC)) {
    const layer = layerOf(file);
    assert.ok(ALLOWED[layer], `${file} is outside the known layers`);
    for (const spec of imports(file)) {
      if (spec.startsWith('.')) {
        const target = layerOf(path.resolve(path.dirname(file), spec));
        if (!ALLOWED[layer].includes(target)) violations.push(`${path.relative(SRC, file)} imports ${target}`);
      } else if (layer === 'domain' && spec.startsWith('node:') && !PURE_NODE.has(spec)) violations.push(`${path.relative(SRC, file)} does I/O through ${spec}`);
      else if (layer === 'domain' && !spec.startsWith('node:')) violations.push(`${path.relative(SRC, file)} imports package ${spec}`);
    }
  }
  assert.deepEqual(violations, []);
});

test('the TUI and the CLI only meet where the CLI starts the TUI', () => {
  const crossings = files(path.join(SRC, 'interfaces')).flatMap((file) => {
    const own = path.relative(path.join(SRC, 'interfaces'), file).split(path.sep)[0];
    return imports(file)
      .filter((s) => s.startsWith('.'))
      .map((s) => path.relative(path.join(SRC, 'interfaces'), path.resolve(path.dirname(file), s)).split(path.sep)[0])
      .filter((other) => !other.startsWith('..') && other !== own)
      .map((other) => `${path.relative(SRC, file)} → ${other}`);
  });
  assert.deepEqual(crossings, ['interfaces/cli/tui.tsx → tui']);
});

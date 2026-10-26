import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function tempDir(): string {
  return realpathSync(mkdtempSync(path.join(os.tmpdir(), 'dc-')));
}

export function write(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

export function installed(root: string, ...projects: string[]): void {
  const later = new Date(Date.now() + 60_000);
  for (const project of projects) {
    write(root, { [`${project}/package-lock.json`]: '{}', [`${project}/node_modules/.package-lock.json`]: '{}' });
    utimesSync(path.join(root, project, 'node_modules/.package-lock.json'), later, later);
  }
}

export function projectTree(): string {
  const root = tempDir();
  write(root, {
    'web/package.json': '{}',
    'web/node_modules/a/node_modules/b/i.js': 'x',
    'web/.next/cache.bin': 'x',
    'web/dist/o.js': 'x',
    'py/pyproject.toml': '',
    'py/.venv/pyvenv.cfg': '',
    'py/src/__pycache__/m.pyc': 'x',
    'loose/venv/x': '',
    'loose/dist/keep.txt': 'keep',
    'tracked/package.json': '{}',
    'tracked/.gitignore': 'dist\n',
    'tracked/build/icon.png': 'k',
    'tracked/dist/o.js': 'x',
    'linked/package.json': '{}',
    'outside/precious': 'p',
    'repo/.git/node_modules/x': '',
    'rust/Cargo.toml': '',
    'rust/target/debug/x': 'x',
    'unity/ProjectSettings/ProjectVersion.txt': '',
    'unity/Library/x': 'x',
    'unity-without-marker/Library/x': 'x',
    'unreal/Game.uproject': '',
    'unreal/Intermediate/x': 'x',
    'rn/package.json': '{}',
    'rn/android/build/x': 'x',
    'old/package.json': '{}',
    'old/package-lock.json': '{}',
    'old/node_modules/x': 'x',
    'old/node_modules/.package-lock.json': '{}',
  });
  execFileSync('git', ['init', '-q'], { cwd: path.join(root, 'tracked') });
  symlinkSync(path.join(root, 'outside'), path.join(root, 'linked/node_modules'));
  const longAgo = new Date('2020-01-01');
  for (const file of ['old/package.json', 'old/package-lock.json', 'old/node_modules/x']) utimesSync(path.join(root, file), longAgo, longAgo);
  return root;
}

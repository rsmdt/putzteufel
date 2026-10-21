import type { PluginSpec } from '../spec.ts';
import { brew } from './shared.ts';

const TOOLCHAINS = 'Toolchains';

export const toolchains: PluginSpec[] = [
  { name: 'Go build cache', category: TOOLCHAINS, tool: brew('go'), paths: ['~/Library/Caches/go-build', '~/.cache/go-build'], list: 'go env GOCACHE', clean: 'go clean -cache' },
  { name: 'Go module cache', category: TOOLCHAINS, tool: brew('go'), paths: ['~/go/pkg/mod'], list: 'go env GOMODCACHE', clean: 'go clean -modcache', impact: 'redownload', description: 'Every downloaded module; go build fetches them again.' },
  { name: 'Cargo registry', category: TOOLCHAINS, tool: brew('cargo-cache'), paths: ['~/.cargo/registry/cache', '~/.cargo/registry/src', '~/.cargo/git/checkouts'], clean: 'cargo cache --autoclean', description: 'cargo-cache keeps downloaded crates and drops extracted sources. Without it the folders are deleted and crates download again on the next build.' },
  { name: 'Gradle caches', category: TOOLCHAINS, paths: ['~/.gradle/caches', '~/.gradle/daemon'] },
  { name: 'Gradle wrapper distributions', category: TOOLCHAINS, paths: ['~/.gradle/wrapper/dists/*'], impact: 'redownload', description: 'Gradle versions used by wrappers, about 150M each to download again.' },
  { name: 'Maven repository', category: TOOLCHAINS, paths: ['~/.m2/repository'], impact: 'redownload', description: 'All downloaded artifacts, plus anything you mvn install-ed locally, which is lost.' },
  { name: 'node-gyp headers', category: TOOLCHAINS, paths: ['~/Library/Caches/node-gyp', '~/.cache/node-gyp'] },
  { name: 'Electron downloads', category: TOOLCHAINS, paths: ['~/Library/Caches/electron', '~/Library/Caches/electron-builder', '~/.cache/electron'] },
  { name: 'TypeScript', category: TOOLCHAINS, paths: ['~/Library/Caches/typescript'] },
];

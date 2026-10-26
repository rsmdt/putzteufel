import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export default definePlugin({
  name: 'Cargo',
  group: GROUPS.rust,
  projects: [
    { name: 'target', markers: ['Cargo.toml'], dirs: ['target'], clean: 'cargo clean', requires: ['cargo'], description: 'Recompiled by the next cargo build. Large projects take minutes.' },
    { name: 'xwin cache', markers: ['Cargo.toml'], dirs: ['.xwin-cache'], impact: 'redownload', description: 'Windows SDK files, downloaded again by cargo xwin.' },
  ],
  items: [{ name: 'Registry', tool: brew('cargo-cache'), paths: ['~/.cargo/registry/cache', '~/.cargo/registry/src', '~/.cargo/git/checkouts'], clean: 'cargo cache --autoclean', impact: 'redownload', description: 'cargo-cache keeps downloaded crates and drops extracted sources. Without it the folders are deleted and crates download again on the next build.' }],
});

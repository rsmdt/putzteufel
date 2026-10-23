import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Cabal',
  group: GROUPS.haskell,
  projects: [{ name: 'dist-newstyle', markers: ['cabal.project'], dirs: ['dist-newstyle'], clean: 'cabal clean', requires: ['cabal'] }],
});

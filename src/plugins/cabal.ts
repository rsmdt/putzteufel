import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Cabal',
  group: GROUPS.haskell,
  projects: [{ name: 'dist-newstyle', markers: ['cabal.project'], dirs: ['dist-newstyle'], clean: 'cabal clean', requires: ['cabal'] }],
});

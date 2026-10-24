import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Stack',
  group: GROUPS.haskell,
  projects: [{ name: '.stack-work', markers: ['stack.yaml'], dirs: ['.stack-work'], clean: 'stack clean --full', requires: ['stack'] }],
});

import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Stack',
  group: GROUPS.haskell,
  projects: [{ name: '.stack-work', markers: ['stack.yaml'], dirs: ['.stack-work'], clean: 'stack clean --full', requires: ['stack'] }],
});

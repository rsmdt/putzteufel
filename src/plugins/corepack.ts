import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'corepack',
  group: GROUPS.javascript,
  items: [{ name: 'Package managers', paths: ['~/.cache/node/corepack'] }],
});

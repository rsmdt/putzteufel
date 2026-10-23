import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'bun',
  group: GROUPS.javascript,
  items: [{ name: 'Cache', paths: ['~/.bun/install/cache', '~/.cache/.bun/install/cache'], description: 'bun pm cache only works inside a project and can point at its node_modules/.cache, so the global cache folder is deleted directly.' }],
});

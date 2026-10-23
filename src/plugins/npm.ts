import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'npm',
  group: GROUPS.javascript,
  items: [{ name: 'Cache', tool: { bin: 'npm' }, paths: ['~/.npm/_cacache'], list: 'echo "$(npm config get cache)/_cacache"', clean: 'npm cache clean --force' }],
});

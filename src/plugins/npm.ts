import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'npm',
  group: GROUPS.javascript,
  items: [{ name: 'Cache', tool: { bin: 'npm' }, paths: ['~/.npm/_cacache'], list: 'echo "$(npm config get cache)/_cacache"', clean: 'npm cache clean --force' }],
});

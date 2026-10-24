import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export default definePlugin({
  name: 'pnpm',
  group: GROUPS.javascript,
  items: [{ name: 'Store', tool: brew('pnpm'), paths: ['~/Library/pnpm/store/*', '~/.local/share/pnpm/store/*'], list: 'pnpm store path', clean: 'pnpm store prune', description: 'Removes packages no project references' }],
});

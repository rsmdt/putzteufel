import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export default definePlugin({
  name: 'mise',
  group: GROUPS.macos,
  items: [{ name: 'Cache', tool: brew('mise'), paths: ['~/.cache/mise', '~/Library/Caches/mise'], list: 'mise cache', clean: 'mise cache clear' }],
});

import { GROUPS } from '../core/index.ts';
import { brew, definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'mise',
  group: GROUPS.macos,
  items: [{ name: 'Cache', tool: brew('mise'), paths: ['~/.cache/mise', '~/Library/Caches/mise'], list: 'mise cache', clean: 'mise cache clear' }],
});

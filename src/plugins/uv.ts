import { GROUPS } from '../core/index.ts';
import { brew, definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'uv',
  group: GROUPS.python,
  items: [{ name: 'Cache', tool: brew('uv'), paths: ['~/.cache/uv', '~/Library/Caches/uv'], list: 'uv cache dir', clean: 'uv cache clean' }],
});

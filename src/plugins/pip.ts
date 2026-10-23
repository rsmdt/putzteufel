import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'pip',
  group: GROUPS.python,
  items: [{ name: 'Cache', tool: { bin: 'pip3' }, paths: ['~/Library/Caches/pip', '~/.cache/pip'], list: 'pip3 cache dir', clean: 'pip3 cache purge' }],
});

import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'XDG caches',
  group: GROUPS.macos,
  items: [{ name: '~/.cache', paths: ['~/.cache/*'], fallback: true, description: 'Everything else in ~/.cache, including shell plugin caches. Review before selecting.', impact: 'unknown' }],
});

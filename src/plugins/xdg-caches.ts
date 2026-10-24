import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'XDG caches',
  group: GROUPS.macos,
  items: [{ name: '~/.cache', paths: ['~/.cache/*'], fallback: true, description: 'Everything else in ~/.cache, including shell plugin caches. Review before selecting.', impact: 'unknown' }],
});

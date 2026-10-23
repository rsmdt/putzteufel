import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'App caches',
  group: GROUPS.macos,
  items: [{ name: '~/Library/Caches', paths: ['~/Library/Caches/*'], fallback: true, impact: 'unknown', description: 'Caches of apps putzteufel does not know. Most rebuild, some hold state such as offline data.' }],
});

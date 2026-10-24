import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'App caches',
  group: GROUPS.macos,
  items: [{ name: '~/Library/Caches', paths: ['~/Library/Caches/*'], fallback: true, impact: 'unknown', description: 'Caches of apps putzteufel does not know. Most rebuild, some hold state such as offline data.' }],
});

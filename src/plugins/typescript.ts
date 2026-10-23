import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'TypeScript',
  group: GROUPS.javascript,
  items: [{ name: 'Type cache', paths: ['~/Library/Caches/typescript'] }],
});

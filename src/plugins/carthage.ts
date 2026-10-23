import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Carthage',
  group: GROUPS.apple,
  items: [{ name: 'Cache', paths: ['~/Library/Caches/org.carthage.CarthageKit'] }],
});

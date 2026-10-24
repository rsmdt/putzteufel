import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Carthage',
  group: GROUPS.apple,
  items: [{ name: 'Cache', paths: ['~/Library/Caches/org.carthage.CarthageKit'] }],
});

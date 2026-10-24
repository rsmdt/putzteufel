import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'JetBrains',
  group: GROUPS.editors,
  items: [
    { name: 'Caches', paths: ['~/Library/Caches/JetBrains/*'], description: 'IDE indexes are rebuilt on next open', impact: 'rebuild' },
    { name: 'Logs', paths: ['~/Library/Logs/JetBrains/*'] },
  ],
});

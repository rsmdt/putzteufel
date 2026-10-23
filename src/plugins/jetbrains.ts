import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'JetBrains',
  group: GROUPS.editors,
  items: [
    { name: 'Caches', paths: ['~/Library/Caches/JetBrains/*'], description: 'IDE indexes are rebuilt on next open', impact: 'rebuild' },
    { name: 'Logs', paths: ['~/Library/Logs/JetBrains/*'] },
  ],
});

import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Logs',
  group: GROUPS.macos,
  items: [{ name: '~/Library/Logs', paths: ['~/Library/Logs/*'], fallback: true }],
});

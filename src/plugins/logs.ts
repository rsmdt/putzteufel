import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Logs',
  group: GROUPS.macos,
  items: [{ name: '~/Library/Logs', paths: ['~/Library/Logs/*'], fallback: true }],
});

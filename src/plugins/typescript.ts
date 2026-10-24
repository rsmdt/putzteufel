import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'TypeScript',
  group: GROUPS.javascript,
  items: [{ name: 'Type cache', paths: ['~/Library/Caches/typescript'] }],
});

import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'node-gyp',
  group: GROUPS.javascript,
  items: [{ name: 'Headers', paths: ['~/Library/Caches/node-gyp', '~/.cache/node-gyp'] }],
});

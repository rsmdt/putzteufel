import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'node-gyp',
  group: GROUPS.javascript,
  items: [{ name: 'Headers', paths: ['~/Library/Caches/node-gyp', '~/.cache/node-gyp'] }],
});

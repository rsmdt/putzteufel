import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Electron',
  group: GROUPS.javascript,
  items: [{ name: 'Downloads', paths: ['~/Library/Caches/electron', '~/Library/Caches/electron-builder', '~/.cache/electron'] }],
});

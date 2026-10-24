import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Electron',
  group: GROUPS.javascript,
  items: [{ name: 'Downloads', paths: ['~/Library/Caches/electron', '~/Library/Caches/electron-builder', '~/.cache/electron'] }],
});

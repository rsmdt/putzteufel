import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export default definePlugin({
  name: 'yarn',
  group: GROUPS.javascript,
  items: [{ name: 'Cache', tool: brew('yarn'), paths: ['~/Library/Caches/Yarn', '~/.cache/yarn'], list: 'yarn cache dir', clean: 'yarn cache clean' }],
});

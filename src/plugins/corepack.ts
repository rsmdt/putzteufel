import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'corepack',
  group: GROUPS.javascript,
  items: [{ name: 'Package managers', paths: ['~/.cache/node/corepack'] }],
});

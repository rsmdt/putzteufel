import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Trash',
  group: GROUPS.macos,
  items: [{ name: 'Trash', paths: ['~/.Trash/*'], impact: 'dataloss', description: 'Same as emptying the Trash.' }],
});

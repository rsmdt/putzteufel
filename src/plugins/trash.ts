import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Trash',
  group: GROUPS.macos,
  items: [{ name: 'Trash', paths: ['~/.Trash/*'], impact: 'dataloss', description: 'Same as emptying the Trash.' }],
});

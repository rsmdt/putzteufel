import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Installers',
  group: GROUPS.macos,
  items: [{ name: 'Disk images and packages in Downloads', paths: ['~/Downloads/*.dmg', '~/Downloads/*.pkg'], impact: 'redownload' }],
});

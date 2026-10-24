import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Installers',
  group: GROUPS.macos,
  items: [{ name: 'Disk images and packages in Downloads', paths: ['~/Downloads/*.dmg', '~/Downloads/*.pkg'], impact: 'redownload' }],
});

import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'VS Code',
  group: GROUPS.editors,
  description: 'Caches and logs of VS Code and its forks. Quit the editor first.',
  items: ['Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium'].map((app) => ({
    name: app,
    paths: ['Cache', 'CachedData', 'CachedExtensionVSIXs', 'Code Cache', 'GPUCache', 'logs'].map((d) => `~/Library/Application Support/${app}/${d}`),
    description: `Caches and logs of ${app}. Quit the editor first.`,
  })),
});

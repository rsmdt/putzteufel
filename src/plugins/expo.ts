import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Expo',
  group: GROUPS.javascript,
  items: [
    {
      name: 'Caches',
      paths: ['ios-simulator-app-cache', 'native-modules-cache', 'schema-cache', 'template-cache', 'versions-cache'].map((d) => `~/.expo/${d}`),
      impact: 'redownload',
      description: 'Expo Go builds, templates and SDK metadata; the Expo CLI downloads them again when needed.',
    },
  ],
});

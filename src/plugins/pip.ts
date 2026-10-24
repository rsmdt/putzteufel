import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'pip',
  group: GROUPS.python,
  items: [{ name: 'Cache', tool: { bin: 'pip3' }, paths: ['~/Library/Caches/pip', '~/.cache/pip'], list: 'pip3 cache dir', clean: 'pip3 cache purge' }],
});

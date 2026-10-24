import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export default definePlugin({
  name: 'poetry',
  group: GROUPS.python,
  items: [{ name: 'Cache', tool: brew('poetry'), paths: ['~/Library/Caches/pypoetry', '~/.cache/pypoetry'], list: 'd="$(poetry config cache-dir)" && echo "$d/cache" && echo "$d/artifacts"', clean: 'poetry cache list | xargs -n1 poetry cache clear --all -n' }],
});

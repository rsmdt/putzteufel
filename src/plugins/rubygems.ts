import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'RubyGems',
  group: GROUPS.ruby,
  items: [{ name: 'Old versions', requires: ['gem'], list: 'gem cleanup --dryrun 2>/dev/null | grep -v "^Clean up complete"', clean: 'gem cleanup' }],
});

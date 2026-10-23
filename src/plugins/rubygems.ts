import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'RubyGems',
  group: GROUPS.ruby,
  items: [{ name: 'Old versions', requires: ['gem'], list: 'gem cleanup --dryrun 2>/dev/null | grep -v "^Clean up complete"', clean: 'gem cleanup' }],
});

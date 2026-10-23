import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Bundler',
  group: GROUPS.ruby,
  projects: [{ name: 'vendor/bundle', markers: ['Gemfile'], dirs: ['vendor/bundle'], description: 'Recreated by bundle install.' }],
});

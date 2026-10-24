import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Bundler',
  group: GROUPS.ruby,
  projects: [{ name: 'vendor/bundle', markers: ['Gemfile'], dirs: ['vendor/bundle'], description: 'Recreated by bundle install.' }],
});

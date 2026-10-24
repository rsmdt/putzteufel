import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Puppeteer',
  group: GROUPS.javascript,
  items: [{ name: 'Browsers', paths: ['~/.cache/puppeteer/*'], impact: 'redownload' }],
});

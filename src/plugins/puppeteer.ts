import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Puppeteer',
  group: GROUPS.javascript,
  items: [{ name: 'Browsers', paths: ['~/.cache/puppeteer/*'], impact: 'redownload' }],
});

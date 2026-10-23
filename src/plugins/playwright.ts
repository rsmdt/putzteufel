import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Playwright',
  group: GROUPS.javascript,
  items: [{ name: 'Browsers', paths: ['~/Library/Caches/ms-playwright/*-*', '~/.cache/ms-playwright/*-*'], impact: 'redownload', description: 'Reinstall with npx playwright install.' }],
});

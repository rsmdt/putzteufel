import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Playwright',
  group: GROUPS.javascript,
  items: [{ name: 'Browsers', tool: { bin: 'playwright' }, paths: ['~/Library/Caches/ms-playwright/*-*', '~/.cache/ms-playwright/*-*'], clean: 'playwright uninstall --all', impact: 'redownload', description: 'Reinstall with npx playwright install. Removed with playwright uninstall --all when the playwright CLI is on PATH.' }],
});

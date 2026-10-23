import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Cypress',
  group: GROUPS.javascript,
  items: [{ name: 'Binaries', paths: ['~/Library/Caches/Cypress/*', '~/.cache/Cypress/*'], impact: 'redownload' }],
});

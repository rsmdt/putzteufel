import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Cypress',
  group: GROUPS.javascript,
  items: [{ name: 'Binaries', tool: { bin: 'cypress' }, paths: ['~/Library/Caches/Cypress/*', '~/.cache/Cypress/*'], clean: 'cypress cache clear', impact: 'redownload', description: 'Removed with cypress cache clear when the cypress CLI is on PATH.' }],
});

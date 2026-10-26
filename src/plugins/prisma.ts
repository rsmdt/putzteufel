import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Prisma',
  group: GROUPS.javascript,
  items: [{ name: 'Engines', paths: ['~/.cache/prisma'], impact: 'redownload', description: 'Query and schema engine binaries; prisma generate downloads them again.' }],
});

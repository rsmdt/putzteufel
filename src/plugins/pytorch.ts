import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'PyTorch',
  group: GROUPS.python,
  items: [{ name: 'Hub', paths: ['~/.cache/torch'], impact: 'redownload' }],
});

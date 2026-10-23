import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'PyTorch',
  group: GROUPS.python,
  items: [{ name: 'Hub', paths: ['~/.cache/torch'], impact: 'redownload' }],
});

import { GROUPS } from '../core/index.ts';
import { brew, definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'pre-commit',
  group: GROUPS.python,
  items: [{ name: 'Hook environments', tool: brew('pre-commit'), paths: ['~/.cache/pre-commit'], clean: 'pre-commit clean' }],
});

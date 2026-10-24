import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export default definePlugin({
  name: 'pre-commit',
  group: GROUPS.python,
  items: [{ name: 'Hook environments', tool: brew('pre-commit'), paths: ['~/.cache/pre-commit'], clean: 'pre-commit clean' }],
});

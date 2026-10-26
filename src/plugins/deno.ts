import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export default definePlugin({
  name: 'deno',
  group: GROUPS.javascript,
  items: [{ name: 'Cache', tool: brew('deno'), paths: ['~/Library/Caches/deno', '~/.cache/deno'], list: `deno info --json | sed -n 's/.*"denoDir": *"\\([^"]*\\)".*/\\1/p'`, clean: 'deno clean', impact: 'dataloss', description: 'deno clean removes the whole DENO_DIR: downloaded modules, and the localStorage data of Deno programs.' }],
});

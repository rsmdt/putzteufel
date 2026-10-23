import { GROUPS } from '../core/index.ts';
import { brew, definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'deno',
  group: GROUPS.javascript,
  items: [{ name: 'Cache', tool: brew('deno'), paths: ['~/Library/Caches/deno', '~/.cache/deno'], list: `deno info --json | sed -n 's/.*"denoDir": *"\\([^"]*\\)".*/\\1/p'`, clean: 'deno clean' }],
});

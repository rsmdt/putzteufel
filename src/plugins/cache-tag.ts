import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'CACHEDIR.TAG',
  group: GROUPS.tagged,
  projects: [{ name: 'Tagged cache', contains: ['CACHEDIR.TAG'], impact: 'regenerates', description: 'The tool that made this folder marked it as a cache with a CACHEDIR.TAG file, so it can be recreated.' }],
});

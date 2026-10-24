import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Zig',
  group: GROUPS.zig,
  projects: [{ name: 'Cache and output', markers: ['build.zig'], dirs: ['zig-cache', '.zig-cache', 'zig-out'] }],
});

import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Zig',
  group: GROUPS.zig,
  projects: [{ name: 'Cache and output', markers: ['build.zig'], dirs: ['zig-cache', '.zig-cache', 'zig-out'] }],
});

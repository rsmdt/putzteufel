import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Pixi',
  group: GROUPS.python,
  projects: [{ name: 'Environments', markers: ['pixi.toml'], dirs: ['.pixi'], description: 'Recreated by pixi install.' }],
});

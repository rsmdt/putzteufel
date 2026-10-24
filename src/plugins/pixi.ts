import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Pixi',
  group: GROUPS.python,
  projects: [{ name: 'Environments', markers: ['pixi.toml'], dirs: ['.pixi'], description: 'Recreated by pixi install.' }],
});

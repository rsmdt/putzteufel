import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Godot',
  group: GROUPS.gameEngines,
  projects: [{ name: '.godot', markers: ['project.godot'], dirs: ['.godot'] }],
});

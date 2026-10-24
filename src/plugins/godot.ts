import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Godot',
  group: GROUPS.gameEngines,
  projects: [{ name: '.godot', markers: ['project.godot'], dirs: ['.godot'] }],
});

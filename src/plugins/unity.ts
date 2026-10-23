import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Unity',
  group: GROUPS.gameEngines,
  projects: [
    { name: 'Library and temp', markers: ['ProjectSettings/ProjectVersion.txt'], dirs: ['Library', 'Temp', 'Obj', 'Logs', 'MemoryCaptures'], description: 'Unity reimports all assets on next open, which can take a long time.' },
    { name: 'Builds', markers: ['ProjectSettings/ProjectVersion.txt'], dirs: ['Build', 'Builds'], impact: 'unknown', description: 'Player builds you made. Keep them if you still need that build.' },
  ],
});

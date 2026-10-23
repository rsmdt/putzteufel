import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'SBT',
  group: GROUPS.java,
  projects: [{ name: 'target', markers: ['build.sbt'], dirs: ['target', 'project/target'] }],
});

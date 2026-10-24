import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'SBT',
  group: GROUPS.java,
  projects: [{ name: 'target', markers: ['build.sbt'], dirs: ['target', 'project/target'] }],
});

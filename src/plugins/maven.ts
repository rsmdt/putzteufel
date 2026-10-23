import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Maven',
  group: GROUPS.java,
  projects: [{ name: 'target', markers: ['pom.xml'], dirs: ['target'] }],
  items: [{ name: 'Repository', paths: ['~/.m2/repository'], impact: 'redownload', description: 'All downloaded artifacts, plus anything you mvn install-ed locally, which is lost.' }],
});

import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Gradle',
  group: GROUPS.java,
  projects: [{ name: 'Build', markers: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'], dirs: ['build', '.gradle'] }],
  items: [
    { name: 'Caches', paths: ['~/.gradle/caches', '~/.gradle/daemon'] },
    { name: 'Wrapper distributions', paths: ['~/.gradle/wrapper/dists/*'], impact: 'redownload', description: 'Gradle versions used by wrappers, about 150M each to download again.' },
  ],
});

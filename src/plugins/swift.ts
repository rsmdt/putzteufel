import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Swift',
  group: GROUPS.apple,
  projects: [{ name: '.build', markers: ['Package.swift'], dirs: ['.build'], clean: 'swift package reset', requires: ['swift'] }],
  items: [{ name: 'SwiftPM cache', paths: ['~/Library/Caches/org.swift.swiftpm'] }],
});

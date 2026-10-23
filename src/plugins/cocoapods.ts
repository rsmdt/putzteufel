import { GROUPS } from '../core/index.ts';
import { brew, definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'CocoaPods',
  group: GROUPS.apple,
  projects: [{ name: 'Pods', markers: ['Podfile'], dirs: ['Pods'], description: 'Recreated by pod install.' }],
  items: [{ name: 'Cache', tool: brew('pod', 'cocoapods'), paths: ['~/Library/Caches/CocoaPods'], clean: 'pod cache clean --all' }],
});

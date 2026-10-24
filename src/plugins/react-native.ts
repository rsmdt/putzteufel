import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'React Native',
  group: GROUPS.javascript,
  projects: [{ name: 'Native builds', markers: ['package.json'], dirs: ['android/build', 'android/.gradle', 'ios/build', 'ios/Pods', 'ios/DerivedData'], description: 'Recreated by the next Gradle, pod install or Xcode build.' }],
});

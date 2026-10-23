import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Xcode',
  group: GROUPS.apple,
  items: [
    { name: 'DerivedData', paths: ['~/Library/Developer/Xcode/DerivedData/*'], impact: 'rebuild', description: 'Indexes and build products; Xcode rebuilds on next open.' },
    { name: 'Previews', paths: ['~/Library/Developer/Xcode/UserData/Previews'] },
    { name: 'Archives', paths: ['~/Library/Developer/Xcode/Archives/*'], description: 'Needed to symbolicate crash reports of shipped builds', impact: 'dataloss' },
    { name: 'Device support files', paths: ['~/Library/Developer/Xcode/*DeviceSupport/*'], impact: 'redownload', description: 'Copied again from the device the next time it is connected.' },
    { name: 'Simulator caches', paths: ['~/Library/Developer/CoreSimulator/Caches'] },
    { name: 'Unavailable simulators', requires: ['xcrun'], list: 'xcrun simctl list devices unavailable | grep "(" || true', clean: 'xcrun simctl delete unavailable' },
  ],
});

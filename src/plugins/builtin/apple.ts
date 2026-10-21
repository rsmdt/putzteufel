import type { PluginSpec } from '../spec.ts';

const APPLE = 'Xcode & Apple';

export const apple: PluginSpec[] = [
  { name: 'Xcode DerivedData', category: APPLE, paths: ['~/Library/Developer/Xcode/DerivedData/*'], impact: 'rebuild', description: 'Indexes and build products; Xcode rebuilds on next open.' },
  { name: 'Xcode Previews', category: APPLE, paths: ['~/Library/Developer/Xcode/UserData/Previews'] },
  { name: 'Xcode Archives', category: APPLE, paths: ['~/Library/Developer/Xcode/Archives/*'], description: 'Needed to symbolicate crash reports of shipped builds', impact: 'dataloss' },
  { name: 'Device support files', category: APPLE, paths: ['~/Library/Developer/Xcode/*DeviceSupport/*'], impact: 'redownload', description: 'Copied again from the device the next time it is connected.' },
  { name: 'Simulator caches', category: APPLE, paths: ['~/Library/Developer/CoreSimulator/Caches'] },
  { name: 'Unavailable simulators', category: APPLE, requires: ['xcrun'], list: 'xcrun simctl list devices unavailable | grep "(" || true', clean: 'xcrun simctl delete unavailable' },
  { name: 'SwiftPM cache', category: APPLE, paths: ['~/Library/Caches/org.swift.swiftpm'] },
  { name: 'Carthage cache', category: APPLE, paths: ['~/Library/Caches/org.carthage.CarthageKit'] },
];

import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Flutter',
  group: GROUPS.dart,
  projects: [{ name: 'Build', markers: ['pubspec.yaml'], dirs: ['build', '.dart_tool', 'linux/flutter/ephemeral', 'windows/flutter/ephemeral', 'macos/Flutter/ephemeral', 'ios/Flutter/ephemeral'], clean: 'flutter clean', requires: ['flutter'] }],
});

import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Dart',
  group: GROUPS.dart,
  items: [{ name: 'Pub cache', tool: { bin: 'dart' }, paths: ['~/.pub-cache'], clean: 'dart pub cache clean --force', impact: 'redownload', description: 'Every package dart pub and flutter pub get downloaded; fetched again on the next pub get.' }],
});

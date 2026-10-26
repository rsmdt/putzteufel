import os from 'node:os';
import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Bazel',
  group: GROUPS.buildTools,
  items: [{ name: 'Output base', paths: ['~/.cache/bazel', `/private/var/tmp/_bazel_${os.userInfo().username}`], impact: 'rebuild', description: 'Build outputs and downloaded repositories of every Bazel workspace; the next bazel build recreates them.' }],
});

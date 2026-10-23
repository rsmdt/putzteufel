import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'CMake',
  group: GROUPS.cpp,
  projects: [{ name: 'Build', markers: ['CMakeLists.txt'], dirs: ['build', 'cmake-build-*'] }],
});

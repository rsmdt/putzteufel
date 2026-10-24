import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'CMake',
  group: GROUPS.cpp,
  projects: [{ name: 'Build', markers: ['CMakeLists.txt'], dirs: ['build', 'cmake-build-*'] }],
});

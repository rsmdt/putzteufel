import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Node',
  group: GROUPS.javascript,
  description: 'node_modules and framework caches inside JavaScript projects.',
  projects: [
    { name: 'Dependencies', markers: ['package.json'], dirs: ['node_modules', '.angular', '.next', '.nuxt', '.output', '.svelte-kit', '.parcel-cache', '.turbo', '.expo', '.metro', '.docusaurus'], description: 'Reinstalled by npm/pnpm/yarn/bun install; framework caches rebuild on the next dev or build run.' },
    { name: 'Build output', markers: ['package.json'], dirs: ['dist', 'build', 'out', 'coverage', 'storybook-static'], impact: 'unknown', description: 'Named like build output. Only a build script can tell whether it is recreated; committed folders are already skipped.' },
  ],
});

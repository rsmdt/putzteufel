import type { PluginSpec } from '../spec.ts';

const EDITORS = 'Editors & IDEs';

const vscodeFamily = ['Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium'].map(
  (app): PluginSpec => ({
    name: `${app} caches`,
    category: EDITORS,
    paths: ['Cache', 'CachedData', 'CachedExtensionVSIXs', 'Code Cache', 'GPUCache', 'logs'].map((d) => `~/Library/Application Support/${app}/${d}`),
    description: `Caches and logs of ${app}. Quit the editor first.`,
  }),
);

export const editors: PluginSpec[] = [
  ...vscodeFamily,
  { name: 'JetBrains caches', category: EDITORS, paths: ['~/Library/Caches/JetBrains/*'], description: 'IDE indexes are rebuilt on next open', impact: 'rebuild' },
  { name: 'JetBrains logs', category: EDITORS, paths: ['~/Library/Logs/JetBrains/*'] },
];

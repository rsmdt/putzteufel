import type { PluginSpec } from '../spec.ts';

const SYSTEM = 'System';

export const system: PluginSpec[] = [
  { name: 'XDG caches (~/.cache)', category: SYSTEM, paths: ['~/.cache/*'], fallback: true, description: 'Everything else in ~/.cache, including shell plugin caches. Review before selecting.', impact: 'unknown' },
  { name: 'User logs', category: SYSTEM, paths: ['~/Library/Logs/*'], fallback: true },
  { name: 'App caches (~/Library/Caches)', category: SYSTEM, paths: ['~/Library/Caches/*'], fallback: true, impact: 'unknown', description: 'Caches of apps putzteufel does not know. Most rebuild, some hold state such as offline data.' },
  { name: 'Installers in Downloads', category: SYSTEM, paths: ['~/Downloads/*.dmg', '~/Downloads/*.pkg'], impact: 'redownload' },
  { name: 'Trash', category: SYSTEM, paths: ['~/.Trash/*'], impact: 'dataloss', description: 'Same as emptying the Trash.' },
];

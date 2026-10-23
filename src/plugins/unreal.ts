import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Unreal',
  group: GROUPS.gameEngines,
  projects: [
    { name: 'Intermediate files', markers: ['*.uproject'], dirs: ['Binaries', 'DerivedDataCache', 'Intermediate'] },
    { name: 'Saved and builds', markers: ['*.uproject'], dirs: ['Saved', 'Build'], impact: 'dataloss', description: 'Saved/ holds autosaves, local config and logs. Build/ holds packaged builds.' },
  ],
});

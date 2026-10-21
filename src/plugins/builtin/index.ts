import type { PluginSpec } from '../spec.ts';
import { packageManagers } from './package-managers.ts';
import { toolchains } from './toolchains.ts';
import { modelsAndBrowsers } from './models-browsers.ts';
import { containers } from './containers.ts';
import { apple } from './apple.ts';
import { editors } from './editors.ts';
import { system } from './system.ts';

export { builtinRules } from './rules.ts';

export const builtinPlugins: PluginSpec[] = [...packageManagers, ...toolchains, ...modelsAndBrowsers, ...containers, ...apple, ...editors, ...system];

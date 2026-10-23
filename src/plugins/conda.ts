import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'conda',
  group: GROUPS.python,
  items: [{ name: 'Packages', tool: { bin: 'conda' }, paths: ['~/miniconda3/pkgs', '~/miniforge3/pkgs', '~/anaconda3/pkgs', '~/.conda/pkgs'], list: 'echo "$(conda info --base)/pkgs"', clean: 'conda clean --all -y' }],
});

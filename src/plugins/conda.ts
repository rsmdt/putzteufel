import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'conda',
  group: GROUPS.python,
  items: [{ name: 'Packages', tool: { bin: 'conda' }, paths: ['~/miniconda3/pkgs', '~/miniforge3/pkgs', '~/anaconda3/pkgs', '~/.conda/pkgs'], list: 'echo "$(conda info --base)/pkgs"', clean: 'conda clean --all -y', impact: 'redownload', description: 'Downloaded packages. conda clean keeps the ones environments still link to; without conda the folders are deleted.' }],
});

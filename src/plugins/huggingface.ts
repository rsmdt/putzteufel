import path from 'node:path';
import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export function repoReference(folder: string): string {
  const [kind, ...name] = path.basename(folder).split('--');
  return `${kind.replace(/s$/, '')}/${name.join('/')}`;
}

export default definePlugin({
  name: 'Hugging Face',
  group: GROUPS.python,
  items: [
    {
      name: 'Models and datasets',
      tool: brew('hf'),
      paths: ['~/.cache/huggingface/hub/models--*', '~/.cache/huggingface/hub/datasets--*'],
      clean: (folder) => `hf cache rm ${repoReference(folder)} --yes`,
      impact: 'redownload',
      description: 'Downloaded again on next load; models are often several GB. Removed with hf cache rm when the hf CLI is installed.',
    },
  ],
});

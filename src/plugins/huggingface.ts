import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Hugging Face',
  group: GROUPS.python,
  items: [{ name: 'Models and datasets', paths: ['~/.cache/huggingface/hub/models--*', '~/.cache/huggingface/hub/datasets--*'], impact: 'redownload', description: 'Downloaded again on next load; models are often several GB.' }],
});

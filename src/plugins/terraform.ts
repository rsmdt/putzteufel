import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Terraform',
  group: GROUPS.terraform,
  projects: [{ name: '.terraform', markers: ['.terraform.lock.hcl'], dirs: ['.terraform'], impact: 'redownload', description: 'Providers and modules, fetched again by terraform init.' }],
  items: [{ name: 'Plugin cache', paths: ['~/.terraform.d/plugin-cache'], impact: 'redownload', description: 'Providers shared between workspaces through TF_PLUGIN_CACHE_DIR; terraform init downloads them again.' }],
});

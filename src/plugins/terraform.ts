import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Terraform',
  group: GROUPS.terraform,
  projects: [{ name: '.terraform', markers: ['.terraform.lock.hcl'], dirs: ['.terraform'], impact: 'redownload', description: 'Providers and modules, fetched again by terraform init.' }],
});

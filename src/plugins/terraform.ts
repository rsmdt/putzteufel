import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Terraform',
  group: GROUPS.terraform,
  projects: [{ name: '.terraform', markers: ['.terraform.lock.hcl'], dirs: ['.terraform'], impact: 'redownload', description: 'Providers and modules, fetched again by terraform init.' }],
});

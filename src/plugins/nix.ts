import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Nix',
  group: GROUPS.nix,
  items: [
    {
      name: 'Unreachable store paths',
      requires: ['nix-store'],
      list: `n=$(nix-store --gc --print-dead 2>/dev/null | wc -l | tr -d ' '); if [ "$n" -gt 0 ]; then echo "$n store paths no profile or GC root uses"; fi`,
      clean: 'nix-store --gc',
      impact: 'redownload',
      description: 'nix-store --gc removes only paths no profile, generation or GC root references, so rollbacks stay.',
    },
  ],
});

import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Podman',
  group: GROUPS.containers,
  items: [{ name: 'Unused data', requires: ['podman'], list: 'podman system df 2>/dev/null || true', clean: 'podman system prune -f', impact: 'dataloss', description: 'Stopped containers, unused images and build cache.' }],
});
